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

const ru: Record<string, string> = {
  'Invalid email or password': 'Неверный email или пароль',
  'Authentication required': 'Требуется аутентификация',
  'Invalid or expired session': 'Сессия недействительна или просрочена',
  'An account with this email already exists':
    'Аккаунт с таким email уже существует',
  'Password must be at least 10 characters':
    'Пароль должен содержать не менее 10 символов',
  'Password must be at most 128 characters':
    'Пароль должен содержать не более 128 символов',
  'Email must be at most 254 characters':
    'Email должен содержать не более 254 символов',
  'Enter a valid email address': 'Введите корректный email-адрес',
  'Name is required': 'Имя обязательно',
  'Name must be at most 100 characters':
    'Имя должно содержать не более 100 символов',
  'Too many authentication attempts. Try again later.':
    'Слишком много попыток входа. Попробуйте позже.',
  'Project not found': 'Проект не найден',
  'Floor not found': 'Этаж не найден',
  'Plan not found': 'План не найден',
  'Read-only access': 'Доступ только для чтения',
  'Project manager access required': 'Требуется доступ менеджера проекта',
  'Not allowed to manage members': 'Нет разрешения управлять участниками',
  'Not a member of this organization':
    'Вы не являетесь участником этой организации',
  'Organization not found': 'Организация не найдена',
  'Estimate not found': 'Смета не найдена',
  'Opening not found': 'Проём не найден',
  'Opening must fit within the wall length':
    'Проём должен помещаться в длину стены',
  'Opening must reference a wall on this plan':
    'Проём должен ссылаться на стену этого плана',
  'Dimension points must not coincide': 'Точки размера не должны совпадать',
  'Current password is incorrect': 'Текущий пароль неверен',
  'Password is incorrect': 'Пароль неверен',
  'Reset link is invalid or expired':
    'Ссылка для сброса недействительна или просрочена',
  'Verification link is invalid or expired':
    'Ссылка для подтверждения недействительна или просрочена',
  'Project revision mismatch': 'Проект был изменён в другой сессии',
  'Plan version mismatch': 'План был изменён в другой сессии',
  'Export link is invalid or expired':
    'Ссылка для экспорта недействительна или просрочена',
  'User not found': 'Пользователь не найден',
  'Variant not found or access denied':
    'Вариант не найден или доступ запрещён',
};

let activeLocale: Locale = 'en';

export function setErrorLocale(locale: Locale): void {
  activeLocale = locale;
}

/** Translates known server messages; unknown messages are returned unchanged. */
export function localizeMessage(message: string, locale = activeLocale): string {
  if (locale === 'en') return message;
  const dictionary = locale === 'ua' ? uk : ru;
  return dictionary[message] ?? message;
}
