const LED_COLORS = {
  online: "#1D9E75",
  offline: "#E24B4A",
  inactive: "#B4B2A9",
  warning: "#EF9F27",
  on: "#1D9E75",
  off: "#B4B2A9",
};

export default function RtLed({ status = "inactive", size = 8, title }) {
  return (
    <span
      className="rt-led"
      style={{ width: size, height: size, background: LED_COLORS[status] || LED_COLORS.inactive }}
      title={title}
    />
  );
}
