import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FormTextField } from "../components/forms/FormTextField";
import { FormSelect } from "../components/forms/FormSelect";
import { FormDateField } from "../components/forms/FormDateField";
import { formatDate, parseToISO, toISODate } from "../dateFormat";
import { colors, radii, spacing } from "../theme";
import { useBreakpoint } from "../useBreakpoint";
import { formatInr } from "../expenses/expenseFormat";
import { searchGroundCustomers } from "./api";
import { computeLocalPricing, inclusiveDays, listGroundRate } from "./pricing";
import {
  ALPHA_CAMPUSES, BALL_COLORS, BALL_TYPES, EVENT_TYPES, GROUND_SPORTS, SLOT_LABELS, SLOT_RATES,
  type AlphaCampus, type BookingPayload, type EventType, type GroundBooking, type GroundCustomer,
  type GroundSport, type LastBookingSummary, type TimeSlot,
} from "./types";

type Props = {
  visible: boolean;
  saving: boolean;
  defaultDate?: string | null;
  booking?: GroundBooking | null;
  onClose: () => void;
  onSubmit: (payload: BookingPayload) => Promise<void>;
};

function Toggle({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={s.toggleBtns}>
        {(["No", "Yes"] as const).map((opt) => {
          const on = (opt === "Yes") === value;
          return (
            <TouchableOpacity
              key={opt}
              testID={`${testID}-${opt.toLowerCase()}`}
              onPress={() => onChange(opt === "Yes")}
              style={[s.toggleChip, on && s.toggleChipOn]}
            >
              <Text style={[s.toggleTxt, on && s.toggleTxtOn]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function lastBookingCopy(last: LastBookingSummary) {
  const slot = last.timeSlot ? SLOT_LABELS[last.timeSlot] : "";
  const dates = last.startDate
    ? last.endDate && last.endDate !== last.startDate
      ? `${formatDate(last.startDate)} – ${formatDate(last.endDate)}`
      : formatDate(last.startDate)
    : "";
  return [last.sport, slot, last.eventType, dates].filter(Boolean).join(" · ");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function Fields({ stack, children }: { stack: boolean; children: ReactNode }) {
  return <View style={[s.fields, stack && s.fieldsStack]}>{children}</View>;
}

function Field({ stack, children }: { stack?: boolean; children: ReactNode }) {
  return <View style={[s.field, stack && s.fieldFull]}>{children}</View>;
}

export function GroundBookingFormModal({ visible, saving, defaultDate, booking, onClose, onSubmit }: Props) {
  const today = toISODate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GroundCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<LastBookingSummary | null>(null);
  const [sport, setSport] = useState<GroundSport>("Cricket");
  const [campus, setCampus] = useState<AlphaCampus>("Balua");
  const [startDisplay, setStartDisplay] = useState(formatDate(defaultDate || today));
  const [endDisplay, setEndDisplay] = useState(formatDate(defaultDate || today));
  const [slot, setSlot] = useState<TimeSlot>("half_day");
  const [customHours, setCustomHours] = useState("");
  const [people, setPeople] = useState("10");
  const [eventType, setEventType] = useState<EventType>("Friendly Match");
  const [groundRate, setGroundRate] = useState(String(SLOT_RATES.half_day));
  const [foodOn, setFoodOn] = useState(false);
  const [foodRate, setFoodRate] = useState("");
  const [foodPeople, setFoodPeople] = useState("10");
  const [transportOn, setTransportOn] = useState(false);
  const [transportRate, setTransportRate] = useState("");
  const [transportPeople, setTransportPeople] = useState("10");
  const [umpireOn, setUmpireOn] = useState(false);
  const [umpireRate, setUmpireRate] = useState("");
  const [umpirePeople, setUmpirePeople] = useState("1");
  const [ballsOn, setBallsOn] = useState(false);
  const [ballType, setBallType] = useState("");
  const [ballColor, setBallColor] = useState("");
  const [ballQty, setBallQty] = useState("1");
  const [ballRate, setBallRate] = useState("");
  const [error, setError] = useState("");
  const slotDaysKey = useRef("");
  const editing = Boolean(booking);
  const { width: winW, height: winH } = useBreakpoint();
  const gutter = winW < 720 ? 12 : 24;
  const sheetW = Math.min(840, Math.max(320, winW - gutter * 2));
  const sheetH = Math.min(winH - gutter * 2, Math.round(winH * 0.92));
  const stack = sheetW < 640;

  const startIso = parseToISO(startDisplay) || "";
  const endIso = parseToISO(endDisplay) || "";
  const days = inclusiveDays(startIso || today, endIso || startIso || today);
  const listRate = listGroundRate(slot, days, Number(groundRate) || 0);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setHits([]);
    setLastBooking(null);
    setError("");
    if (booking) {
      slotDaysKey.current = `${booking.dates.timeSlot}|${inclusiveDays(booking.dates.startDate, booking.dates.endDate)}`;
      const add = booking.addOns || {};
      setName(booking.customer?.name || "");
      setOrg(booking.customer?.organization || "");
      setPhone(booking.customer?.phone || "");
      setAddress(booking.customer?.address || "");
      setPersonId(booking.customer?.sourcePersonId || null);
      setSport(booking.sport);
      setCampus(booking.campus || "Balua");
      setStartDisplay(formatDate(booking.dates.startDate));
      setEndDisplay(formatDate(booking.dates.endDate));
      setSlot(booking.dates.timeSlot);
      setCustomHours(booking.dates.customHours != null ? String(booking.dates.customHours) : "");
      setPeople(String(booking.eventDetails?.numberOfPeople || 1));
      setEventType(booking.eventDetails?.type || "Friendly Match");
      setGroundRate(String(booking.pricing?.groundRate ?? SLOT_RATES.half_day));
      setFoodOn(Boolean(add.food?.enabled));
      setFoodRate(add.food?.ratePerPlate ? String(add.food.ratePerPlate) : "");
      setFoodPeople(String(add.food?.people || booking.eventDetails?.numberOfPeople || 1));
      setTransportOn(Boolean(add.transport?.enabled));
      setTransportRate(add.transport?.ratePerPerson ? String(add.transport.ratePerPerson) : "");
      setTransportPeople(String(add.transport?.people || booking.eventDetails?.numberOfPeople || 1));
      setUmpireOn(Boolean(add.umpire?.enabled));
      setUmpireRate(add.umpire?.ratePerDay ? String(add.umpire.ratePerDay) : "");
      setUmpirePeople(String(add.umpire?.people || 1));
      setBallsOn(Boolean(add.balls?.enabled));
      setBallType(add.balls?.type || "");
      setBallColor(add.balls?.color || "");
      setBallQty(String(add.balls?.quantity || 1));
      setBallRate(add.balls?.ratePerBall ? String(add.balls.ratePerBall) : "");
      return;
    }
    slotDaysKey.current = "half_day|1";
    const iso = defaultDate || today;
    setStartDisplay(formatDate(iso));
    setEndDisplay(formatDate(iso));
    setName("");
    setOrg("");
    setPhone("");
    setAddress("");
    setPersonId(null);
    setSport("Cricket");
    setCampus("Balua");
    setSlot("half_day");
    setCustomHours("");
    setPeople("10");
    setEventType("Friendly Match");
    setGroundRate(String(SLOT_RATES.half_day));
    setFoodOn(false);
    setFoodRate("");
    setFoodPeople("10");
    setTransportOn(false);
    setTransportRate("");
    setTransportPeople("10");
    setUmpireOn(false);
    setUmpireRate("");
    setUmpirePeople("1");
    setBallsOn(false);
    setBallType("");
    setBallColor("");
    setBallQty("1");
    setBallRate("");
  }, [visible, defaultDate, today, booking]);

  useEffect(() => {
    const key = `${slot}|${days}`;
    if (slotDaysKey.current === key) return;
    slotDaysKey.current = key;
    if (slot === "custom") return;
    setGroundRate(String(listGroundRate(slot, days, 0)));
  }, [slot, days]);

  useEffect(() => {
    if (!visible || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setHits(await searchGroundCustomers(query.trim()));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query, visible]);

  const pricing = useMemo(
    () =>
      computeLocalPricing({
        slot,
        startIso: startIso || today,
        endIso: endIso || startIso || today,
        groundRate: Number(groundRate) || 0,
        people: Number(people) || 0,
        foodOn,
        foodRate: Number(foodRate) || 0,
        foodPeople: Number(foodPeople) || 0,
        transportOn,
        transportRate: Number(transportRate) || 0,
        transportPeople: Number(transportPeople) || 0,
        umpireOn,
        umpireRate: Number(umpireRate) || 0,
        umpirePeople: Number(umpirePeople) || 1,
        ballsOn,
        ballQty: Number(ballQty) || 0,
        ballRate: Number(ballRate) || 0,
      }),
    [slot, startIso, endIso, today, groundRate, people, foodOn, foodRate, foodPeople, transportOn, transportRate, transportPeople, umpireOn, umpireRate, umpirePeople, ballsOn, ballQty, ballRate],
  );

  const pickCustomer = (c: GroundCustomer) => {
    setName(c.name || "");
    setOrg(c.organization || "");
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setPersonId(c.id || null);
    setLastBooking(c.lastBooking || null);
    setQuery("");
    setHits([]);
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Name of the person is required.");
    if (!phone.trim()) return setError("Contact number is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!startIso || !endIso) return setError("Booking date range is required.");
    if (endIso < startIso) return setError("End date cannot be before start date.");
    const headcount = Number(people);
    if (!headcount || headcount < 1) return setError("Number of people must be at least 1.");
    if (!(Number(groundRate) > 0)) return setError("Enter the ground/venue rate.");
    if (foodOn && !(Number(foodPeople) > 0)) return setError("Enter number of persons for food.");
    if (transportOn && !(Number(transportPeople) > 0)) return setError("Enter number of persons for transport.");
    if (umpireOn && !(Number(umpirePeople) > 0)) return setError("Enter number of umpires / referees.");
    if (ballsOn && (!ballType || !ballColor)) return setError("Select ball type and colour.");
    const payload: BookingPayload = {
      sport,
      campus,
      customer: {
        name: name.trim(),
        organization: org.trim() || undefined,
        phone: phone.trim(),
        address: address.trim(),
        sourcePersonId: personId,
      },
      startDate: startIso,
      endDate: endIso,
      timeSlot: slot,
      customHours: slot === "custom" ? Number(customHours) || null : null,
      eventType,
      numberOfPeople: headcount,
      groundRate: Number(groundRate) || 0,
      food: { enabled: foodOn, ratePerPlate: Number(foodRate) || 0, people: Number(foodPeople) || 0 },
      transport: { enabled: transportOn, ratePerPerson: Number(transportRate) || 0, people: Number(transportPeople) || 0 },
      umpire: { enabled: umpireOn, ratePerDay: Number(umpireRate) || 0, people: Number(umpirePeople) || 0 },
      balls: {
        enabled: ballsOn,
        type: ballsOn ? ballType : null,
        color: ballsOn ? ballColor : null,
        quantity: Number(ballQty) || 0,
        ratePerBall: Number(ballRate) || 0,
      },
    };
    await onSubmit(payload);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[s.sheet, { width: sheetW, height: sheetH }]} testID="ground-booking-form">
          <View style={s.sheetHead}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text style={s.kicker}>ALPHA · OPERATIONS</Text>
              <Text style={s.sheetTitle} numberOfLines={1}>{editing ? "Edit Tentative Booking" : "New Ground Booking"}</Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="close-booking-form" style={s.iconBtn}>
              <Feather name="x" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyInner}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {lastBooking ? (
              <View style={s.lastCard} testID="last-booking-summary">
                <View style={s.lastBadge}>
                  <Feather name="clock" size={12} color="#0369A1" />
                  <Text style={s.lastBadgeTxt}>Last booking</Text>
                </View>
                <Text style={s.lastTitle}>{lastBookingCopy(lastBooking)}</Text>
                <Text style={s.lastMeta}>
                  {lastBooking.numberOfPeople ? `${lastBooking.numberOfPeople} people` : "Headcount not recorded"}
                  {lastBooking.addOns?.length ? ` · ${lastBooking.addOns.join(", ")}` : " · No add-ons"}
                  {lastBooking.status ? ` · ${lastBooking.status}` : ""}
                  {lastBooking.totalRevenue != null ? ` · ${formatInr(lastBooking.totalRevenue)}` : ""}
                </Text>
              </View>
            ) : null}

            <Section title="Search existing customer">
              <FormTextField
                label="Search"
                compact
                placeholder="Person name, organisation, or mobile"
                value={query}
                onChangeText={setQuery}
                testID="customer-search"
              />
              {searching ? <Text style={s.hint}>Searching…</Text> : null}
              {hits.map((h, i) => (
                <TouchableOpacity key={`${h.phone}-${i}`} style={s.hit} onPress={() => pickCustomer(h)} testID={`customer-hit-${i}`}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.hitName}>{h.name}</Text>
                    <Text style={s.hitMeta}>{[h.organization, h.phone].filter(Boolean).join(" · ")}</Text>
                    {h.lastBooking ? (
                      <Text style={s.hitLast} numberOfLines={1}>Last: {lastBookingCopy(h.lastBooking)}</Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.hint} />
                </TouchableOpacity>
              ))}
            </Section>

            <Section title="Contact details">
              <Fields stack={stack}>
                <Field stack={stack}>
                  <FormTextField label="Name of the Person" required compact value={name} onChangeText={setName} testID="field-name" />
                </Field>
                <Field stack={stack}>
                  <FormTextField label="Name of Club or Organization" compact value={org} onChangeText={setOrg} testID="field-org" />
                </Field>
                <Field stack={stack}>
                  <FormTextField label="Contact Number" required compact keyboardType="phone-pad" value={phone} onChangeText={setPhone} testID="field-phone" />
                </Field>
                <Field stack={stack}>
                  <FormTextField label="Address" required compact multiline value={address} onChangeText={setAddress} testID="field-address" />
                </Field>
              </Fields>
            </Section>

            <Section title="Booking details">
              <View style={s.sportRow}>
                {GROUND_SPORTS.map((opt) => {
                  const on = sport === opt;
                  return (
                    <TouchableOpacity key={opt} onPress={() => setSport(opt)} style={[s.sportChip, on && s.sportChipOn]} testID={`sport-${opt}`}>
                      <Text style={[s.sportTxt, on && s.sportTxtOn]}>{opt === "Cricket" ? "🏏 Cricket" : "⚽ Football"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Fields stack={stack}>
                <Field stack={stack}>
                  <FormSelect
                    label="Campus / Ground"
                    required
                    compact
                    value={campus}
                    onChange={(v) => setCampus(v as AlphaCampus)}
                    options={ALPHA_CAMPUSES.map((c) => ({ label: c, value: c }))}
                    testID="booking-campus"
                  />
                </Field>
              </Fields>
              <Fields stack={stack}>
                <Field stack={stack}>
                  <FormDateField label="Start date" required compact value={startDisplay} onChangeText={setStartDisplay} />
                </Field>
                <Field stack={stack}>
                  <FormDateField label="End date" required compact value={endDisplay} onChangeText={setEndDisplay} />
                </Field>
              </Fields>
              <Text style={s.hint}>{days} day{days === 1 ? "" : "s"} selected</Text>

              <Text style={s.fieldLbl}>Time slot</Text>
              <View style={[s.slotRow, stack && s.slotRowStack]}>
                {(["half_day", "full_day"] as const).map((opt) => {
                  const on = slot === opt;
                  const rate = SLOT_RATES[opt] * days;
                  return (
                    <TouchableOpacity
                      key={opt}
                      testID={`slot-${opt}`}
                      onPress={() => setSlot(opt)}
                      style={[s.slotCard, stack && s.slotCardStack, on && s.slotCardOn]}
                    >
                      <Text style={[s.slotName, on && s.slotNameOn]}>{SLOT_LABELS[opt]}</Text>
                      <Text style={[s.slotRate, on && s.slotRateOn]}>{formatInr(SLOT_RATES[opt])}</Text>
                      <Text style={[s.slotHint, on && s.slotHintOn]}>
                        {days > 1 ? `${formatInr(rate)} for ${days} days` : "Default list rate"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => setSlot("custom")} style={[s.customLink, slot === "custom" && s.customLinkOn]} testID="slot-custom">
                <Text style={s.customLinkTxt}>{slot === "custom" ? "Custom hours selected" : "Need a custom duration?"}</Text>
              </TouchableOpacity>
              {slot === "custom" ? (
                <FormTextField label="Custom hours" compact keyboardType="decimal-pad" value={customHours} onChangeText={setCustomHours} />
              ) : null}

              <Fields stack={stack}>
                <Field stack={stack}>
                  <FormTextField label="Number of People" required compact keyboardType="number-pad" value={people} onChangeText={(v) => {
                    setPeople(v);
                    if (!foodOn) setFoodPeople(v);
                    if (!transportOn) setTransportPeople(v);
                  }} testID="field-people" />
                </Field>
                <Field stack={stack}>
                  <FormSelect
                    label="Event Type"
                    required
                    compact
                    value={eventType}
                    onChange={(v) => setEventType(v as EventType)}
                    options={EVENT_TYPES.map((x) => ({ value: x, label: x }))}
                  />
                </Field>
              </Fields>
            </Section>

            <Section title="Add-ons & costing">
              <FormTextField
                label="Ground / Venue Base Rate"
                compact
                keyboardType="decimal-pad"
                value={groundRate}
                onChangeText={setGroundRate}
                hint={slot !== "custom" ? `Default ${formatInr(listRate)} for ${SLOT_LABELS[slot]} × ${days} day${days === 1 ? "" : "s"}` : "Enter the agreed venue rate"}
                testID="field-ground-rate"
              />
              {pricing.discountRequested ? (
                <View style={s.warn}>
                  <Feather name="alert-triangle" size={14} color="#B45309" />
                  <Text style={s.warnTxt}>
                    Discount of {formatInr(pricing.discountAmount)} will be sent to Super Admin as a task for approval.
                  </Text>
                </View>
              ) : null}

              <View style={s.addonCard}>
                <Toggle label="Food" value={foodOn} onChange={(v) => {
                  setFoodOn(v);
                  if (v && !foodPeople) setFoodPeople(people || "1");
                }} testID="addon-food" />
                {foodOn ? (
                  <Fields stack={stack}>
                    <Field stack={stack}>
                      <FormTextField label="Rate per plate" compact keyboardType="decimal-pad" value={foodRate} onChangeText={setFoodRate} />
                    </Field>
                    <Field stack={stack}>
                      <FormTextField label="Number of persons" compact keyboardType="number-pad" value={foodPeople} onChangeText={setFoodPeople} testID="food-people" />
                    </Field>
                  </Fields>
                ) : null}
                {foodOn ? <Text style={s.costLine}>Food total {formatInr(pricing.foodCost)}</Text> : null}
              </View>

              <View style={s.addonCard}>
                <Toggle label="Transport" value={transportOn} onChange={(v) => {
                  setTransportOn(v);
                  if (v && !transportPeople) setTransportPeople(people || "1");
                }} testID="addon-transport" />
                {transportOn ? (
                  <Fields stack={stack}>
                    <Field stack={stack}>
                      <FormTextField label="Rate per person" compact keyboardType="decimal-pad" value={transportRate} onChangeText={setTransportRate} />
                    </Field>
                    <Field stack={stack}>
                      <FormTextField label="Number of persons" compact keyboardType="number-pad" value={transportPeople} onChangeText={setTransportPeople} testID="transport-people" />
                    </Field>
                  </Fields>
                ) : null}
                {transportOn ? <Text style={s.costLine}>Transport total {formatInr(pricing.transportCost)}</Text> : null}
              </View>

              <View style={s.addonCard}>
                <Toggle label="Umpire / Referee needed" value={umpireOn} onChange={setUmpireOn} testID="addon-umpire" />
                {umpireOn ? (
                  <Fields stack={stack}>
                    <Field stack={stack}>
                      <FormTextField label="Rate per day" compact keyboardType="decimal-pad" value={umpireRate} onChangeText={setUmpireRate} />
                    </Field>
                    <Field stack={stack}>
                      <FormTextField label="Number of persons" compact keyboardType="number-pad" value={umpirePeople} onChangeText={setUmpirePeople} testID="umpire-people" />
                    </Field>
                  </Fields>
                ) : null}
                {umpireOn ? <Text style={s.costLine}>Umpire total {formatInr(pricing.umpireCost)} ({days} day{days === 1 ? "" : "s"})</Text> : null}
              </View>

              <View style={s.addonCard}>
                <Toggle label="Ball needed" value={ballsOn} onChange={setBallsOn} testID="addon-balls" />
                {ballsOn ? (
                  <>
                    <Fields stack={stack}>
                      <Field stack={stack}>
                        <FormSelect label="Ball type" compact value={ballType} onChange={setBallType} options={BALL_TYPES.map((x) => ({ value: x, label: x }))} />
                      </Field>
                      <Field stack={stack}>
                        <FormSelect label="Colour" compact value={ballColor} onChange={setBallColor} options={BALL_COLORS.map((x) => ({ value: x, label: x }))} />
                      </Field>
                    </Fields>
                    <Fields stack={stack}>
                      <Field stack={stack}>
                        <FormTextField label="Quantity" compact keyboardType="number-pad" value={ballQty} onChangeText={setBallQty} />
                      </Field>
                      <Field stack={stack}>
                        <FormTextField label="Rate per ball" compact keyboardType="decimal-pad" value={ballRate} onChangeText={setBallRate} />
                      </Field>
                    </Fields>
                  </>
                ) : null}
                {ballsOn ? <Text style={s.costLine}>Balls total {formatInr(pricing.ballCost)}</Text> : null}
              </View>
            </Section>
          </ScrollView>

          <View style={s.footer}>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <View style={s.totalRow}>
              <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <Text style={s.totalLabel}>Total revenue</Text>
                <Text style={s.totalHint}>
                  Ground {formatInr(pricing.groundRate)} + add-ons {formatInr(pricing.addOnTotal)}
                </Text>
              </View>
              <Text style={s.totalValue}>{formatInr(pricing.totalRevenue)}</Text>
            </View>
            <TouchableOpacity
              testID="submit-booking"
              disabled={saving}
              onPress={submit}
              style={[s.submit, saving && { opacity: 0.6 }]}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>{editing ? "Save Changes" : "Submit Booking"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const webBlock = Platform.select({
  web: { display: "block", position: "relative", height: "auto", overflow: "visible" } as object,
  default: {},
});

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: radii.xl,
    overflow: "hidden",
    flexDirection: "column",
    zIndex: 2,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  kicker: { fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 1 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  body: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({ web: { overflowY: "auto", overflowX: "hidden" } as object, default: {} }),
  },
  bodyInner: { padding: spacing.md, paddingBottom: spacing.lg },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 12,
    width: "100%",
    ...webBlock,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 10 },
  sectionBody: { width: "100%", ...webBlock },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, width: "100%" },
  fieldsStack: { flexDirection: "column", marginHorizontal: 0 },
  field: { width: "50%", paddingHorizontal: 6, marginBottom: 10 },
  fieldFull: { width: "100%", paddingHorizontal: 0 },
  lastCard: {
    backgroundColor: "#E0F2FE",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    ...webBlock,
  },
  lastBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  lastBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#0369A1", textTransform: "uppercase", letterSpacing: 0.6 },
  lastTitle: { fontSize: 14, fontWeight: "800", color: colors.ink },
  lastMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  hint: { fontSize: 11, color: colors.muted2, marginBottom: 8 },
  hit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  hitName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  hitMeta: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  hitLast: { fontSize: 11, color: "#0369A1", marginTop: 3, fontWeight: "600" },
  sportRow: { flexDirection: "row", gap: 8, marginBottom: spacing.sm, flexWrap: "wrap" },
  sportChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sportChipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  sportTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  sportTxtOn: { color: colors.primary },
  fieldLbl: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: spacing.sm, marginBottom: 8 },
  slotRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: 4 },
  slotRowStack: { flexDirection: "column" },
  slotCard: {
    flexGrow: 1,
    flexBasis: "48%",
    minWidth: 160,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  slotCardStack: { width: "100%", flexBasis: "auto", minWidth: 0 },
  slotCardOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  slotName: { fontSize: 13, fontWeight: "800", color: colors.ink },
  slotNameOn: { color: colors.primary },
  slotRate: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 4 },
  slotRateOn: { color: colors.accent },
  slotHint: { fontSize: 11, color: colors.muted2, marginTop: 4 },
  slotHintOn: { color: colors.primary },
  customLink: { marginTop: 8, marginBottom: 8, alignSelf: "flex-start" },
  customLinkOn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.primarySoft, borderRadius: radii.sm },
  customLinkTxt: { fontSize: 12, fontWeight: "700", color: colors.accent },
  addonCard: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...webBlock,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  toggleLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  toggleBtns: { flexDirection: "row", gap: 8, flexShrink: 0 },
  toggleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggleChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  toggleTxtOn: { color: "#fff" },
  costLine: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 8 },
  warn: { flexDirection: "row", gap: 8, backgroundColor: "#FEF3C7", borderRadius: radii.md, padding: spacing.sm, marginTop: 8 },
  warnTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  totalLabel: { fontSize: 12, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.6 },
  totalHint: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.ink },
  submit: { backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600" },
});
