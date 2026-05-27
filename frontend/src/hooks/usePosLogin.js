import { useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { hasPosAccess } from "../components/pos-restaurant/RequirePosAccess";

const POS_HOME_PATH = "/pos-restaurant/tables";

function getErrorMessage(error) {
  if (error?.payload?.detail) return error.payload.detail;
  if (error?.payload?.error) return error.payload.error;
  if (error?.message) return error.message;
  return "Erreur de connexion. Veuillez reessayer.";
}

export function usePosLogin() {
  const { login, completeTwoFactorLogin } = useAuth();
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [otpCode, setOtpCode] = useState("");

  const validate = () => {
    if (challengeId) {
      if (!otpCode.trim()) {
        setError("Renseignez le code de securite.");
        return false;
      }
      setError(null);
      return true;
    }

    if (!identifiant.trim()) {
      setError("Renseignez votre identifiant ou votre email.");
      return false;
    }
    if (!password) {
      setError("Le mot de passe est obligatoire.");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event, navigate, targetPath = POS_HOME_PATH) => {
    if (event) event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const payload = challengeId
        ? await completeTwoFactorLogin({ challengeId, code: otpCode.trim() })
        : await login({
            username: identifiant.trim(),
            password,
            remember_me: remember,
          });

      if (payload.two_factor_required) {
        setChallengeId(payload.challenge_id);
        return;
      }

      if (!hasPosAccess(payload.user)) {
        setError("Acces non autorise. Verifiez vos permissions POS.");
        return;
      }

      navigate(targetPath || POS_HOME_PATH, { replace: true });
    } catch (err) {
      if (err?.status === 401 || err?.status === 400 || err?.payload?.non_field_errors) {
        setError("Identifiant ou mot de passe incorrect.");
      } else if (err?.status === 403) {
        setError("Acces non autorise. Verifiez vos permissions POS.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    identifiant,
    setIdentifiant,
    password,
    setPassword,
    remember,
    setRemember,
    showPassword,
    setShowPassword,
    loading,
    error,
    setError,
    challengeId,
    otpCode,
    setOtpCode,
    handleSubmit,
  };
}

