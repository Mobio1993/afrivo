export default function HotelsSkeleton() {
  return (
    <div className="sr-hotels-skeleton" aria-hidden="true">
      <div className="sr-hotels-skeleton-bar" />
      <div className="sr-hotels-kpi-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="sr-hotels-kpi sr-skeleton-block" key={item} />
        ))}
      </div>
      {[1, 2, 3].map((item) => (
        <div className="sr-hotel-card sr-hotel-card-skeleton" key={item}>
          <div className="sr-skeleton-line is-wide" />
          <div className="sr-hotel-metrics">
            <div className="sr-skeleton-block" />
            <div className="sr-skeleton-block" />
            <div className="sr-skeleton-block" />
            <div className="sr-skeleton-block" />
          </div>
        </div>
      ))}
    </div>
  );
}
