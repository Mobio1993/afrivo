from apps.audit_logs.services import PosAuditService


class PosAuditLogger:
    def log(self, user, action, data=None):
        return PosAuditService.log(user, action, data)


pos_audit_logger = PosAuditLogger()
