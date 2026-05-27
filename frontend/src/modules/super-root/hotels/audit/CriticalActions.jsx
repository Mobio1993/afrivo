import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function CriticalActions({ onSuspend, onReactivate, onMaintenance, hotel }) {
  return (
    <SrCard title="Actions critiques">
      <div className="sr-list">
        <button className="sr-btn sr-btn-danger" type="button" disabled={!hotel?.is_active} onClick={onSuspend}>Suspendre hotel</button>
        <button className="sr-btn" type="button" disabled={hotel?.is_active} onClick={onReactivate}>Reactiver hotel</button>
        <button className="sr-btn sr-btn-outline" type="button" onClick={onMaintenance}>Maintenance</button>
      </div>
    </SrCard>
  );
}
