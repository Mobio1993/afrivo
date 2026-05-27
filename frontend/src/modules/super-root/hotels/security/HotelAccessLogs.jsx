import HotelActivityFeed from "../detail/HotelActivityFeed";

export default function HotelAccessLogs({ logs = [] }) {
  return <HotelActivityFeed activity={logs} />;
}
