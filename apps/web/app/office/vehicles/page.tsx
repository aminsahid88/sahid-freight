"use client";
/**
 * Vehicles & Drivers: unit profiles (tank capacity, ELD) and driver phones
 * used for attributing texted receipts to the right truck.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Truck, Users } from "lucide-react";
import { backoffice, type Driver, type Vehicle } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";

function VehiclesContent() {
  const { t } = useT();
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [error, setError] = useState("");
  const [showVehicle, setShowVehicle] = useState(welcome);
  const [showDriver, setShowDriver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState({ unitNumber: "", vin: "", plate: "", axles: "5", tankCapacityGal: "", eldProvider: "" });
  const [d, setD] = useState({ name: "", phone: "", defaultVehicleId: "", language: "EN" as "EN" | "SO" });

  const load = (cid: string) =>
    Promise.all([backoffice.vehicles(cid), backoffice.drivers(cid)]).then(([vs, ds]) => {
      setVehicles(vs);
      setDrivers(ds);
    });

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    load(companyId)
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))))
      .finally(() => !cancelled && setLoadedFor(companyId));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError("");
    try {
      await backoffice.addVehicle(companyId, {
        unitNumber: v.unitNumber.trim(),
        vin: v.vin.trim() || undefined,
        plate: v.plate.trim() || undefined,
        axles: v.axles ? Number(v.axles) : undefined,
        tankCapacityGal: v.tankCapacityGal.trim() || undefined,
        eldProvider: v.eldProvider.trim() || undefined,
      });
      setV({ unitNumber: "", vin: "", plate: "", axles: "5", tankCapacityGal: "", eldProvider: "" });
      setShowVehicle(false);
      await load(companyId);
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError("");
    try {
      await backoffice.addDriver(companyId, { name: d.name.trim(), phone: d.phone.trim() || undefined, defaultVehicleId: d.defaultVehicleId || undefined, language: d.language });
      setD({ name: "", phone: "", defaultVehicleId: "", language: "EN" });
      setShowDriver(false);
      await load(companyId);
    } catch (err) {
      setError(formatApiError(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  const loading = loadedFor !== companyId;

  return (
    <div>
      <PageHeader title={t("vehicles.title")} description={t("vehicles.subtitle")} />
      {welcome && <Banner tone="success" className="mb-4" title={t("vehicles.welcomeTitle")}>{t("vehicles.welcome")}</Banner>}
      {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("vehicles.trucks")} description={t("vehicles.trucksHint")} action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowVehicle((s) => !s)}>{t("vehicles.addVehicle")}</Button>} />
          <CardBody>
            {showVehicle && (
              <form onSubmit={saveVehicle} className="mb-4 grid gap-3 rounded-card bg-surface p-4">
                <Input label={t("vehicles.unitNumber")} required value={v.unitNumber} onChange={(e) => setV({ ...v, unitNumber: e.target.value })} placeholder="101" />
                <Input label={t("vehicles.vin")} maxLength={17} value={v.vin} onChange={(e) => setV({ ...v, vin: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("vehicles.plate")} value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value })} />
                  <Input label={t("vehicles.axles")} type="number" min={2} max={10} value={v.axles} onChange={(e) => setV({ ...v, axles: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("vehicles.tankCapacity")} inputMode="decimal" placeholder="300" value={v.tankCapacityGal} onChange={(e) => setV({ ...v, tankCapacityGal: e.target.value })} />
                  <Input label={t("vehicles.eldProvider")} placeholder="Motive, Samsara…" value={v.eldProvider} onChange={(e) => setV({ ...v, eldProvider: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={saving}>{t("common.save")}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowVehicle(false)}>{t("common.cancel")}</Button>
                </div>
              </form>
            )}
            {loading ? (
              <SkeletonRows rows={2} />
            ) : vehicles.length === 0 ? (
              <EmptyState icon={<Truck size={18} />} title={t("vehicles.emptyVehicles")} className="py-8" />
            ) : (
              <ul>
                {vehicles.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">#{x.unitNumber}</div>
                      <div className="truncate text-xs text-ink-3">{[x.plate, x.vin, x.eldProvider, x.tankCapacityGal ? `${Number(x.tankCapacityGal)} gal` : null].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <Pill label={x.iftaQualified ? t("vehicles.iftaQualified") : t("vehicles.inactive")} tone={x.iftaQualified ? "green" : "grey"} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("vehicles.drivers")} description={t("vehicles.driversHint")} action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowDriver((s) => !s)}>{t("vehicles.addDriver")}</Button>} />
          <CardBody>
            {showDriver && (
              <form onSubmit={saveDriver} className="mb-4 grid gap-3 rounded-card bg-surface p-4">
                <Input label={t("vehicles.driverName")} required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
                <Input label={t("vehicles.driverPhone")} type="tel" inputMode="tel" placeholder="+16125550100" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label={t("vehicles.defaultVehicle")} value={d.defaultVehicleId} onChange={(e) => setD({ ...d, defaultVehicleId: e.target.value })}>
                    <option value="">—</option>
                    {vehicles.map((x) => (
                      <option key={x.id} value={x.id}>#{x.unitNumber}</option>
                    ))}
                  </Select>
                  <Select label={t("vehicles.language")} value={d.language} onChange={(e) => setD({ ...d, language: e.target.value as "EN" | "SO" })}>
                    <option value="EN">English</option>
                    <option value="SO">Soomaali</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={saving}>{t("common.save")}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowDriver(false)}>{t("common.cancel")}</Button>
                </div>
              </form>
            )}
            {loading ? (
              <SkeletonRows rows={2} />
            ) : drivers.length === 0 ? (
              <EmptyState icon={<Users size={18} />} title={t("vehicles.emptyDrivers")} className="py-8" />
            ) : (
              <ul>
                {drivers.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink">{x.name}</div>
                      <div className="truncate text-xs text-ink-3">{[x.phone, x.defaultVehicle ? `#${x.defaultVehicle.unitNumber}` : null, x.language === "SO" ? "Soomaali" : "English"].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Pill label={x.active ? t("vehicles.active") : t("vehicles.inactive")} tone={x.active ? "green" : "grey"} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense>
      <VehiclesContent />
    </Suspense>
  );
}
