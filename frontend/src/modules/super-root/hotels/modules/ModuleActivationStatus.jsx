import { SrBadge } from "../../../../features/super-root/shared/SuperRootShared";

export default function ModuleActivationStatus({ module }) {
  return <SrBadge tone={module.is_valid ? "ok" : "warning"}>{module.status}</SrBadge>;
}
