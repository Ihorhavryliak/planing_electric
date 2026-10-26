export type Locale = 'uk' | 'en' | 'pl';

export const LOCALE_STORAGE_KEY = 'drawmyplace-locale';

export const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'uk', label: 'Українська' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
];

type Dictionary = Record<string, string>;

const en: Dictionary = {
  'nav.organizations': 'Organizations',
  'nav.materials': 'Materials',
  'nav.notifications': 'Notifications',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign out',
  'nav.signingOut': 'Signing out…',
  'nav.language': 'Language',
  'nav.themeSystem': 'Theme: system',
  'nav.themeLight': 'Theme: light',
  'nav.themeDark': 'Theme: dark',
  'nav.verifyEmail': 'Verify your email to secure your account.',
  'nav.resendEmail': 'Resend email',
  'nav.sending': 'Sending…',
  'nav.verificationSent': 'Verification email sent.',

  'auth.login.title': 'Welcome back',
  'auth.login.subtitle':
    'Sign in to continue planning electrical installations.',
  'auth.login.submit': 'Sign in',
  'auth.login.submitting': 'Signing in…',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.name': 'Name',
  'auth.forgot': 'Forgot password?',
  'auth.newHere': 'New to DrawMyPlace?',
  'auth.createAccount': 'Create an account',
  'auth.register.title': 'Create your account',
  'auth.register.submit': 'Create account',
  'auth.register.submitting': 'Creating…',
  'auth.register.haveAccount': 'Already have an account?',
  'auth.register.signIn': 'Sign in',
  'auth.forgot.title': 'Reset your password',
  'auth.forgot.subtitle': 'We will email you a link that expires in one hour.',
  'auth.forgot.submit': 'Send reset link',
  'auth.forgot.sending': 'Sending…',
  'auth.forgot.sent':
    'If an account exists for that address, a reset link has been sent.',
  'auth.forgot.back': 'Back to sign in',
  'auth.reset.title': 'Choose a new password',
  'auth.reset.subtitle': 'This link works once and expires after one hour.',
  'auth.reset.newPassword': 'New password',
  'auth.reset.confirmPassword': 'Confirm password',
  'auth.reset.submit': 'Set new password',
  'auth.reset.saving': 'Saving…',
  'auth.reset.done':
    'Password updated. You can now sign in with the new password.',
  'auth.reset.mismatch': 'Passwords do not match.',

  'settings.title': 'Settings',
  'settings.subtitle':
    'Update your profile. Email changes are not available yet.',
  'settings.name': 'Name',
  'settings.email': 'Email',
  'settings.save': 'Save changes',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved',
  'settings.appearance': 'Appearance',
  'settings.appearanceHint':
    'Follow the system setting or choose a theme explicitly.',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.changePassword': 'Change password',
  'settings.currentPassword': 'Current password',
  'settings.newPassword': 'New password',
  'settings.updatePassword': 'Update password',
  'settings.passwordUpdated': 'Password updated',
  'settings.sessions': 'Active sessions',
  'settings.revoke': 'Revoke',
  'settings.thisSession': '(this session)',
  'settings.data': 'Your data',
  'settings.dataHint':
    'Download a JSON copy of your profile, projects, drawings, and estimates.',
  'settings.downloadData': 'Download account data',
  'settings.danger': 'Danger zone',
  'settings.dangerHint':
    'Deleting your account removes all projects, drawings, and estimates.',
  'settings.confirmPassword': 'Confirm with your password',
  'settings.deleteAccount': 'Delete account',
  'settings.deleting': 'Deleting…',
  'settings.back': 'Back',
};

const uk: Dictionary = {
  'nav.organizations': 'Організації',
  'nav.materials': 'Матеріали',
  'nav.notifications': 'Сповіщення',
  'nav.settings': 'Налаштування',
  'nav.signOut': 'Вийти',
  'nav.signingOut': 'Вихід…',
  'nav.language': 'Мова',
  'nav.themeSystem': 'Тема: системна',
  'nav.themeLight': 'Тема: світла',
  'nav.themeDark': 'Тема: темна',
  'nav.verifyEmail': 'Підтвердьте email, щоб захистити акаунт.',
  'nav.resendEmail': 'Надіслати лист',
  'nav.sending': 'Надсилання…',
  'nav.verificationSent': 'Лист із підтвердженням надіслано.',

  'auth.login.title': 'З поверненням',
  'auth.login.subtitle':
    'Увійдіть, щоб продовжити планування електромонтажу.',
  'auth.login.submit': 'Увійти',
  'auth.login.submitting': 'Вхід…',
  'auth.email': 'Email',
  'auth.password': 'Пароль',
  'auth.name': "Ім'я",
  'auth.forgot': 'Забули пароль?',
  'auth.newHere': 'Ще не маєте акаунта?',
  'auth.createAccount': 'Створити акаунт',
  'auth.register.title': 'Створіть акаунт',
  'auth.register.submit': 'Створити акаунт',
  'auth.register.submitting': 'Створення…',
  'auth.register.haveAccount': 'Вже маєте акаунт?',
  'auth.register.signIn': 'Увійти',
  'auth.forgot.title': 'Скидання пароля',
  'auth.forgot.subtitle': 'Ми надішлемо посилання, чинне одну годину.',
  'auth.forgot.submit': 'Надіслати посилання',
  'auth.forgot.sending': 'Надсилання…',
  'auth.forgot.sent':
    'Якщо акаунт із такою адресою існує, лист із посиланням надіслано.',
  'auth.forgot.back': 'Повернутися до входу',
  'auth.reset.title': 'Новий пароль',
  'auth.reset.subtitle': 'Посилання одноразове й діє одну годину.',
  'auth.reset.newPassword': 'Новий пароль',
  'auth.reset.confirmPassword': 'Підтвердіть пароль',
  'auth.reset.submit': 'Зберегти пароль',
  'auth.reset.saving': 'Збереження…',
  'auth.reset.done': 'Пароль оновлено. Тепер увійдіть із новим паролем.',
  'auth.reset.mismatch': 'Паролі не збігаються.',

  'settings.title': 'Налаштування',
  'settings.subtitle':
    'Оновіть профіль. Зміна email поки недоступна.',
  'settings.name': "Ім'я",
  'settings.email': 'Email',
  'settings.save': 'Зберегти',
  'settings.saving': 'Збереження…',
  'settings.saved': 'Збережено',
  'settings.appearance': 'Вигляд',
  'settings.appearanceHint':
    'Дотримуйтеся системного налаштування або виберіть тему явно.',
  'settings.system': 'Системна',
  'settings.light': 'Світла',
  'settings.dark': 'Темна',
  'settings.changePassword': 'Змінити пароль',
  'settings.currentPassword': 'Поточний пароль',
  'settings.newPassword': 'Новий пароль',
  'settings.updatePassword': 'Оновити пароль',
  'settings.passwordUpdated': 'Пароль оновлено',
  'settings.sessions': 'Активні сесії',
  'settings.revoke': 'Відкликати',
  'settings.thisSession': '(ця сесія)',
  'settings.data': 'Ваші дані',
  'settings.dataHint':
    'Завантажте JSON-копію профілю, проєктів, креслень і кошторисів.',
  'settings.downloadData': 'Завантажити дані',
  'settings.danger': 'Небезпечна зона',
  'settings.dangerHint':
    'Видалення акаунта прибере всі проєкти, креслення та кошториси.',
  'settings.confirmPassword': 'Підтвердьте паролем',
  'settings.deleteAccount': 'Видалити акаунт',
  'settings.deleting': 'Видалення…',
  'settings.back': 'Назад',
};

const dictionaries: Record<Locale, Dictionary> = {
  en,
  uk,
  // Polish is intentionally maintained as a target catalog; missing keys fall
  // back to English until the translation pass is complete.
  pl: { ...en },
};

export function isLocale(value: unknown): value is Locale {
  return value === 'uk' || value === 'en' || value === 'pl';
}

export function readLocale(
  storage: Pick<Storage, 'getItem'> | null,
): Locale {
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return 'en';
}

export function writeLocale(
  storage: Pick<Storage, 'setItem'> | null,
  locale: Locale,
): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

export function formatLocale(locale: Locale): string {
  return locale === 'uk' ? 'uk-UA' : locale === 'pl' ? 'pl-PL' : 'en-US';
}
