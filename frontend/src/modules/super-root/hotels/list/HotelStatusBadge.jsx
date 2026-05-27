import { SrBadge } from "../../../../features/super-root/shared/SuperRootShared";
import { subscriptionLabel, subscriptionTone } from "../utils/hotelUi";

export default function HotelStatusBadge({ active, status }) {
  if (status) {
    return <SrBadge tone={subscriptionTone(status)}>{subscriptionLabel(status)}</SrBadge>;
  }
  return <SrBadge tone={active ? "ok" : "danger"}>{active ? "Actif" : "Suspendu"}</SrBadge>;
}
