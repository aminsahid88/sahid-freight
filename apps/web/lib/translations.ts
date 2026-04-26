export const t: Record<string, Record<string, string>> = {
  // Navigation
  overview:        { en: "Overview",     am: "አጠቃላይ",      so: "Guud ahaan" },
  loads:           { en: "Loads",        am: "ጭነቶች",        so: "Xamuulada" },
  my_loads:        { en: "My Loads",     am: "ጭነቶቼ",        so: "Xamuuladayda" },
  fleet:           { en: "Fleet",        am: "መርሃ ግብር",     so: "Gawaari" },
  drivers:         { en: "Drivers",      am: "አሽከርካሪዎች",   so: "Darawallada" },
  bookings:        { en: "Bookings",     am: "ቦታ ማስያዣዎች",  so: "Buugista" },
  alerts:          { en: "Alerts",       am: "ማስጠንቀቂያዎች",  so: "Ogeysiisyada" },
  profile:         { en: "Profile",      am: "መለያ",         so: "Profile" },

  // Actions
  sign_in:         { en: "Sign In",      am: "ግባ",           so: "Gal" },
  sign_out:        { en: "Sign Out",     am: "ውጣ",           so: "Ka bax" },
  register:        { en: "Register",     am: "ተመዝገብ",        so: "Is diiwaan geli" },
  submit:          { en: "Submit",       am: "አስገባ",          so: "Gudbi" },
  cancel:          { en: "Cancel",       am: "ሰርዝ",           so: "Jooji" },
  save:            { en: "Save",         am: "አስቀምጥ",         so: "Keydi" },
  upload:          { en: "Upload",       am: "ስቀል",           so: "Soo rar" },
  apply:           { en: "Apply",        am: "ተግብር",          so: "Codso" },
  add_truck:       { en: "Add Truck",    am: "ተሽከርካሪ ጨምር",  so: "Gaariga ku dar" },
  add_driver:      { en: "Add Driver",   am: "አሽከርካሪ ጨምር",  so: "Darawalle ku dar" },
  find_loads:      { en: "Find Loads",   am: "ጭነቶችን ፈልግ",   so: "Xamuul raadi" },
  post_load:       { en: "Post Load",    am: "ጭነት ለጥፍ",      so: "Xamuul sheeq" },

  // Status
  available:       { en: "Available",    am: "ይገኛል",          so: "La heli karo" },
  busy:            { en: "Busy",         am: "ተያዟል",          so: "Mashquul" },
  open:            { en: "Open",         am: "ክፍት",           so: "Furan" },
  booked:          { en: "Booked",       am: "ተይዟል",          so: "La qabsaday" },
  delivered:       { en: "Delivered",    am: "ደርሷል",          so: "La gadhsiiyay" },
  pending:         { en: "Pending",      am: "በጥብቅ ይጠብቃል",  so: "La sugayo" },
  verified:        { en: "Verified",     am: "ተረጋግጧል",       so: "La xaqiijiyay" },

  // Dashboard
  welcome_back:    { en: "Welcome back", am: "እንኳን ደህና መጡ",  so: "Ku soo dhawoow" },
  total_loads:     { en: "Total Loads",  am: "ጠቅላላ ጭነቶች",   so: "Wadarta Xamuulada" },
  my_fleet:        { en: "My Fleet",     am: "መርሃ ግብሬ",      so: "Gawaarigtayda" },
  coverage:        { en: "Coverage",     am: "ሽፋን",           so: "Daboolid" },

  // Settings
  language:        { en: "Language",     am: "ቋንቋ",           so: "Luqadda" },
  theme:           { en: "Theme",        am: "ገጽታ",           so: "Muuqaalka" },
  light:           { en: "Light",        am: "ብርሃን",          so: "Iftiinka" },
  dark:            { en: "Dark",         am: "ጨለማ",           so: "Madow" },

  // Verification
  verify_account:  { en: "Verify Account",       am: "መለያ አረጋግጥ",         so: "Xaqiiji Koontada" },
  docs_under_review: { en: "Documents Under Review", am: "ሰነዶች በግምገማ ላይ", so: "Dukumiintiyada Dib u eegista" },
  account_verified: { en: "Account Verified",    am: "መለያ ተረጋግጧል",       so: "Koontada Xaqiijisay" },

  // Phone
  phone_number:    { en: "Phone Number", am: "ስልክ ቁጥር",       so: "Lambarka Telefoonka" },
  password:        { en: "Password",     am: "የይለፍ ቃል",       so: "Furaha sirta" },
  forgot_password: { en: "Forgot password?", am: "የይለፍ ቃል ረሱ?", so: "Furaha sirta ma ilowday?" },
};

export function tr(key: string, lang: string): string {
  return t[key]?.[lang] || t[key]?.["en"] || key;
}
