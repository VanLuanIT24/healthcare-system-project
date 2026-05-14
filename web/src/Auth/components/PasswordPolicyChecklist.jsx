import { CheckCircle2, Circle } from 'lucide-react';
import { evaluatePasswordPolicy, getRecoveryActor } from '../recovery/recoveryConfig';

export function PasswordPolicyChecklist({ actorType, password, identifiers = [] }) {
  const actor = getRecoveryActor(actorType);
  const checks = evaluatePasswordPolicy(actorType, password, identifiers);

  return (
    <div className="auth-recovery-policy">
      <strong>{actor.passwordPolicyTitle}</strong>
      <ul>
        {actor.policyChecks.map((item) => {
          const isValid = Boolean(checks[item.key]);
          const Icon = isValid ? CheckCircle2 : Circle;

          return (
            <li key={item.key} className={isValid ? 'is-valid' : ''}>
              <Icon size={18} />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
      <small>Frontend hỗ trợ kiểm tra nhanh. Máy chủ vẫn là nơi xác thực cuối cùng.</small>
    </div>
  );
}
