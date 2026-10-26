import type { Locale } from './i18n';

const uk: Record<string, string> = {
  'Invalid email or password': 'Невірний email або пароль',
  'Authentication required': 'Потрібна автентифікація',
  'Invalid or expired session': 'Сесія недійсна або прострочена',
  'An account with this email already exists':
    'Акаунт із таким email уже існує',
  'Password must be at least 10 characters':
    'Пароль має містити щонайменше 10 символів',
  'Password must be at most 128 characters':
    'Пароль має містити не більше 128 символів',
  'Email must be at most 254 characters':
    'Email має містити не більше 254 символів',
  'Enter a valid email address': 'Введіть коректну email-адресу',
  'Name is required': "Ім'я обов'язкове",
  'Name must be at most 100 characters':
    "Ім'я має містити не більше 100 символів",
  'Too many authentication attempts. Try again later.':
    'Забагато спроб входу. Спробуйте пізніше.',
  'Project not found': 'Проєкт не знайдено',
  'Floor not found': 'Поверх не знайдено',
  'Plan not found': 'План не знайдено',
  'Read-only access': 'Доступ лише для читання',
  'Project manager access required': 'Потрібен доступ менеджера проєкту',
  'Not allowed to manage members': 'Немає дозволу керувати учасниками',
  'Not a member of this organization':
    'Ви не є учасником цієї організації',
  'Organization not found': 'Організацію не знайдено',
  'Estimate not found': 'Кошторис не знайдено',
  'Opening not found': 'Отвір не знайдено',
  'Opening must fit within the wall length':
    'Отвір має вміщатися в довжину стіни',
  'Opening must reference a wall on this plan':
    'Отвір має посилатися на стіну цього плану',
  'Dimension points must not coincide': 'Точки розміру не повинні збігатися',
  'Current password is incorrect': 'Поточний пароль неправильний',
  'Password is incorrect': 'Пароль неправильний',
  'Reset link is invalid or expired':
    'Посилання для скидання недійсне або прострочене',
  'Verification link is invalid or expired':
    'Посилання для підтвердження недійсне або прострочене',
  'Project revision mismatch': 'Проєкт було змінено в іншій сесії',
  'Plan version mismatch': 'План було змінено в іншій сесії',
  'Export link is invalid or expired':
    'Посилання для експорту недійсне або прострочене',
  'User not found': 'Користувача не знайдено',
  'Variant not found or access denied':
    'Варіант не знайдено або доступ заборонено',
};

let activeLocale: Locale = 'en';

export function setErrorLocale(locale: Locale): void {
  activeLocale = locale;
}

/** Translates known server messages; unknown messages are returned unchanged. */
export function localizeMessage(message: string, locale = activeLocale): string {
  if (locale === 'en') return message;
  const dictionary = locale === 'uk' ? uk : uk;
  return dictionary[message] ?? message;
}
