import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { OperatorUserProfile } from '../types/billing';

interface AuthLoginGateProps {
  organizationName: string;
  operatorProfile: OperatorUserProfile;
  onCredentialsLogin: (email: string) => void;
}

export const AuthLoginGate: React.FC<AuthLoginGateProps> = ({
  organizationName,
  operatorProfile,
  onCredentialsLogin,
}) => {
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const normalizedInputEmail = emailInput.trim().toLowerCase();
    const expectedEmail = operatorProfile.email.trim().toLowerCase();

    if (
      normalizedInputEmail === expectedEmail &&
      passwordInput === operatorProfile.accessPassword
    ) {
      onCredentialsLogin(operatorProfile.email);
    } else {
      setLocalError('Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Corporate Identity Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
          <img
            src="/icon.svg"
            alt="Bairaq Al-Wafrah"
            className="w-11 h-11 rounded-xl object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
              Bairaq Al-Wafrah
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Enterprise Manpower Billing &amp; Statement System
            </p>
          </div>
        </div>

        {/* Clean Zero-Leak Email & Password Login Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4" autoComplete="off">
          {localError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="operator-login-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Email Address*
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="operator-login-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                autoComplete="username"
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="operator-login-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Password*
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="operator-login-password"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0088FF]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Sign In
            </button>
          </div>
        </form>

        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Authorized Personnel Only</span>
          <span>Encrypted Workspace</span>
        </div>
      </div>
    </div>
  );
};

interface OperatorProfileSettingsViewProps {
  profile: OperatorUserProfile;
  onUpdateProfile: (updated: OperatorUserProfile) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OperatorProfileSettingsView: React.FC<OperatorProfileSettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onShowToast,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [roleTitle, setRoleTitle] = useState(profile.roleTitle);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (currentPassword !== profile.accessPassword) {
      onShowToast('Current password is required to update operator credentials.', 'error');
      return;
    }

    const updatedPassword = newPassword.trim()
      ? newPassword.trim()
      : profile.accessPassword;

    onUpdateProfile({
      fullName: fullName.trim() || profile.fullName,
      roleTitle: roleTitle.trim() || profile.roleTitle,
      email: email.trim(),
      phone: phone.trim(),
      accessPassword: updatedPassword,
    });
    setCurrentPassword('');
    setNewPassword('');
    onShowToast('Operator profile & security credentials updated.');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl">
      <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
        <UserCheck className="w-5 h-5 text-[#0088FF]" />
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Operator User Profile &amp; Security Credentials
          </h2>
          <p className="text-xs text-slate-500">
            Update operator details or change your login email and password. Changes automatically sync to Google Drive when connected.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Operator Full Name*
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Role / Designation
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Operator Login Email*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Password (Required to Save)*
            </label>
            <div className="relative">
              <input
                type={showCurrentPass ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full pr-9 px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
              >
                {showCurrentPass ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (Optional)
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full pr-9 px-3 py-2 text-xs font-mono-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
              >
                {showNewPass ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#0088FF] rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Check className="w-4 h-4" />
            Save Operator Profile
          </button>
        </div>
      </form>
    </div>
  );
};
