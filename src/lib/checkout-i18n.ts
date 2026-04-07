// ─── Checkout i18n ─────────────────────────────────────────────────────────────

export type CheckoutLocale = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'it';

export interface CheckoutTranslations {
  // Header
  checkout: string;
  session: string;

  // Form section
  paymentDetails: string;
  fullName: string;
  fullNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  address: string;
  addressPlaceholder: string;
  country: string;
  selectCountry: string;

  // Pay button
  pay: string;
  processing: string;

  // Auto-save
  saving: string;

  // Error
  sessionInvalid: string;
  sessionExpiredMsg: string;
  sessionExpiredShort: string;
  tryAgain: string;
  paymentFailedMsg: string;

  // Processing
  processingPayment: string;
  redirectingTo: string;
  doNotClose: string;

  // External payment (SumUp)
  completePayment: string;
  cancelAndGoBack: string;

  // Order summary
  orderSummary: string;
  secureCheckout: string;
  transactionId: string;
  currencyLabel: string;
  paymentMethod: string;
  total: string;

  // Trust badges
  sslEncrypted: string;
  securePayment: string;
  pciCompliant: string;

  // Footer
  secureHostedCheckout: string;

  // Payment methods
  card: string;
}

const en: CheckoutTranslations = {
  checkout: 'Checkout',
  session: 'Session',
  paymentDetails: 'Payment Details',
  fullName: 'Full Name',
  fullNamePlaceholder: 'John Doe',
  email: 'Email',
  emailPlaceholder: 'john@example.com',
  phone: 'Phone',
  phonePlaceholder: '+351 912 345 678',
  address: 'Address',
  addressPlaceholder: '123 Main Street',
  country: 'Country',
  selectCountry: 'Select country',
  pay: 'Pay',
  processing: 'Processing...',
  saving: 'Saving...',
  sessionInvalid: 'Session Invalid',
  sessionExpiredMsg: 'This checkout session is invalid or has expired. Please contact the merchant for a new payment link.',
  sessionExpiredShort: 'This checkout session is invalid or has expired.',
  tryAgain: 'Try Again',
  paymentFailedMsg: 'Could not initiate payment. Please try again.',
  processingPayment: 'Processing Payment',
  redirectingTo: 'Redirecting to',
  doNotClose: 'Please do not close this page.',
  completePayment: 'Complete Payment',
  cancelAndGoBack: 'Cancel and go back',
  orderSummary: 'Order Summary',
  secureCheckout: 'Secure Checkout',
  transactionId: 'Transaction ID',
  currencyLabel: 'Currency',
  paymentMethod: 'Payment Method',
  total: 'Total',
  sslEncrypted: 'SSL Encrypted',
  securePayment: 'Secure Payment',
  pciCompliant: 'PCI Compliant',
  secureHostedCheckout: 'Secure hosted checkout',
  card: 'Card',
};

const pt: CheckoutTranslations = {
  checkout: 'Finalizar Compra',
  session: 'Sessão',
  paymentDetails: 'Dados de Pagamento',
  fullName: 'Nome Completo',
  fullNamePlaceholder: 'João Silva',
  email: 'Email',
  emailPlaceholder: 'joao@exemplo.pt',
  phone: 'Telefone',
  phonePlaceholder: '+351 912 345 678',
  address: 'Morada',
  addressPlaceholder: 'Rua Principal, 123',
  country: 'País',
  selectCountry: 'Selecionar país',
  pay: 'Pagar',
  processing: 'A processar...',
  saving: 'A guardar...',
  sessionInvalid: 'Sessão Inválida',
  sessionExpiredMsg: 'Esta sessão de checkout é inválida ou expirou. Contacte o comerciante para obter um novo link de pagamento.',
  sessionExpiredShort: 'Esta sessão de checkout é inválida ou expirou.',
  tryAgain: 'Tentar Novamente',
  paymentFailedMsg: 'Não foi possível iniciar o pagamento. Tente novamente.',
  processingPayment: 'A Processar Pagamento',
  redirectingTo: 'A redirecionar para o provedor de pagamento de',
  doNotClose: 'Por favor, não feche esta página.',
  completePayment: 'Completar Pagamento',
  cancelAndGoBack: 'Cancelar e voltar',
  orderSummary: 'Resumo da Encomenda',
  secureCheckout: 'Checkout Seguro',
  transactionId: 'ID da Transação',
  currencyLabel: 'Moeda',
  paymentMethod: 'Método de Pagamento',
  total: 'Total',
  sslEncrypted: 'Encriptado SSL',
  securePayment: 'Pagamento Seguro',
  pciCompliant: 'Conforme PCI',
  secureHostedCheckout: 'Checkout seguro',
  card: 'Cartão',
};

const es: CheckoutTranslations = {
  checkout: 'Finalizar Compra',
  session: 'Sesión',
  paymentDetails: 'Datos de Pago',
  fullName: 'Nombre Completo',
  fullNamePlaceholder: 'Juan García',
  email: 'Correo Electrónico',
  emailPlaceholder: 'juan@ejemplo.es',
  phone: 'Teléfono',
  phonePlaceholder: '+34 612 345 678',
  address: 'Dirección',
  addressPlaceholder: 'Calle Mayor, 123',
  country: 'País',
  selectCountry: 'Seleccionar país',
  pay: 'Pagar',
  processing: 'Procesando...',
  saving: 'Guardando...',
  sessionInvalid: 'Sesión Inválida',
  sessionExpiredMsg: 'Esta sesión de pago es inválida o ha expirado. Contacte al comerciante para obtener un nuevo enlace de pago.',
  sessionExpiredShort: 'Esta sesión de pago es inválida o ha expirado.',
  tryAgain: 'Intentar de Nuevo',
  paymentFailedMsg: 'No se pudo iniciar el pago. Inténtelo de nuevo.',
  processingPayment: 'Procesando Pago',
  redirectingTo: 'Redirigiendo al proveedor de pago de',
  doNotClose: 'Por favor, no cierre esta página.',
  completePayment: 'Completar Pago',
  cancelAndGoBack: 'Cancelar y volver',
  orderSummary: 'Resumen del Pedido',
  secureCheckout: 'Pago Seguro',
  transactionId: 'ID de Transacción',
  currencyLabel: 'Moneda',
  paymentMethod: 'Método de Pago',
  total: 'Total',
  sslEncrypted: 'Cifrado SSL',
  securePayment: 'Pago Seguro',
  pciCompliant: 'Conforme PCI',
  secureHostedCheckout: 'Checkout seguro',
  card: 'Tarjeta',
};

const fr: CheckoutTranslations = {
  checkout: 'Paiement',
  session: 'Session',
  paymentDetails: 'Coordonnées Bancaires',
  fullName: 'Nom Complet',
  fullNamePlaceholder: 'Jean Dupont',
  email: 'Email',
  emailPlaceholder: 'jean@exemple.fr',
  phone: 'Téléphone',
  phonePlaceholder: '+33 6 12 34 56 78',
  address: 'Adresse',
  addressPlaceholder: '123 Rue Principale',
  country: 'Pays',
  selectCountry: 'Sélectionner le pays',
  pay: 'Payer',
  processing: 'Traitement...',
  saving: 'Enregistrement...',
  sessionInvalid: 'Session Invalide',
  sessionExpiredMsg: 'Cette session de paiement est invalide ou a expiré. Veuillez contacter le marchand pour obtenir un nouveau lien de paiement.',
  sessionExpiredShort: 'Cette session de paiement est invalide ou a expiré.',
  tryAgain: 'Réessayer',
  paymentFailedMsg: 'Impossible de lancer le paiement. Veuillez réessayer.',
  processingPayment: 'Traitement du Paiement',
  redirectingTo: 'Redirection vers le prestataire de paiement de',
  doNotClose: 'Veuillez ne pas fermer cette page.',
  completePayment: 'Compléter le Paiement',
  cancelAndGoBack: 'Annuler et revenir',
  orderSummary: 'Résumé de la Commande',
  secureCheckout: 'Paiement Sécurisé',
  transactionId: 'ID de Transaction',
  currencyLabel: 'Devise',
  paymentMethod: 'Méthode de Paiement',
  total: 'Total',
  sslEncrypted: 'Chiffrement SSL',
  securePayment: 'Paiement Sécurisé',
  pciCompliant: 'Conforme PCI',
  secureHostedCheckout: 'Checkout sécurisé',
  card: 'Carte',
};

const de: CheckoutTranslations = {
  checkout: 'Bestellung',
  session: 'Sitzung',
  paymentDetails: 'Zahlungsdetails',
  fullName: 'Vollständiger Name',
  fullNamePlaceholder: 'Max Mustermann',
  email: 'E-Mail',
  emailPlaceholder: 'max@beispiel.de',
  phone: 'Telefon',
  phonePlaceholder: '+49 170 1234567',
  address: 'Adresse',
  addressPlaceholder: 'Hauptstraße 123',
  country: 'Land',
  selectCountry: 'Land auswählen',
  pay: 'Bezahlen',
  processing: 'Verarbeitung...',
  saving: 'Speichern...',
  sessionInvalid: 'Sitzung Ungültig',
  sessionExpiredMsg: 'Diese Checkout-Sitzung ist ungültig oder abgelaufen. Bitte kontaktieren Sie den Händler für einen neuen Zahlungslink.',
  sessionExpiredShort: 'Diese Checkout-Sitzung ist ungültig oder abgelaufen.',
  tryAgain: 'Erneut Versuchen',
  paymentFailedMsg: 'Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.',
  processingPayment: 'Zahlung wird Verarbeitet',
  redirectingTo: 'Weiterleitung zum Zahlungsanbieter von',
  doNotClose: 'Bitte schließen Sie diese Seite nicht.',
  completePayment: 'Zahlung Abschließen',
  cancelAndGoBack: 'Abbrechen und zurück',
  orderSummary: 'Bestellübersicht',
  secureCheckout: 'Sichere Bezahlung',
  transactionId: 'Transaktions-ID',
  currencyLabel: 'Währung',
  paymentMethod: 'Zahlungsmethode',
  total: 'Gesamt',
  sslEncrypted: 'SSL-Verschlüsselt',
  securePayment: 'Sichere Zahlung',
  pciCompliant: 'PCI-Konform',
  secureHostedCheckout: 'Sicheres Checkout',
  card: 'Karte',
};

const it: CheckoutTranslations = {
  checkout: 'Checkout',
  session: 'Sessione',
  paymentDetails: 'Dati di Pagamento',
  fullName: 'Nome Completo',
  fullNamePlaceholder: 'Mario Rossi',
  email: 'Email',
  emailPlaceholder: 'mario@esempio.it',
  phone: 'Telefono',
  phonePlaceholder: '+39 312 345 6789',
  address: 'Indirizzo',
  addressPlaceholder: 'Via Principale, 123',
  country: 'Paese',
  selectCountry: 'Selezionare il paese',
  pay: 'Paga',
  processing: 'Elaborazione...',
  saving: 'Salvataggio...',
  sessionInvalid: 'Sessione Non Valida',
  sessionExpiredMsg: 'Questa sessione di pagamento non è valida o è scaduta. Contattare il venditore per un nuovo link di pagamento.',
  sessionExpiredShort: 'Questa sessione di pagamento non è valida o è scaduta.',
  tryAgain: 'Riprova',
  paymentFailedMsg: 'Impossibile avviare il pagamento. Riprova.',
  processingPayment: 'Elaborazione del Pagamento',
  redirectingTo: 'Reindirizzamento al fornitore di pagamento di',
  doNotClose: 'Non chiudere questa pagina.',
  completePayment: 'Completa il Pagamento',
  cancelAndGoBack: 'Annulla e torna',
  orderSummary: 'Riepilogo Ordine',
  secureCheckout: 'Checkout Sicuro',
  transactionId: 'ID Transazione',
  currencyLabel: 'Valuta',
  paymentMethod: 'Metodo di Pagamento',
  total: 'Totale',
  sslEncrypted: 'Crittografia SSL',
  securePayment: 'Pagamento Sicuro',
  pciCompliant: 'Conforme PCI',
  secureHostedCheckout: 'Checkout sicuro',
  card: 'Carta',
};

// ─── Translation registry ──────────────────────────────────────────────────────

const TRANSLATIONS: Record<CheckoutLocale, CheckoutTranslations> = {
  en, pt, es, fr, de, it,
};

export function t(locale: CheckoutLocale): CheckoutTranslations {
  return TRANSLATIONS[locale] ?? TRANSLATIONS.en;
}

// ─── Country → Locale mapping ──────────────────────────────────────────────────

export const COUNTRY_TO_LOCALE: Record<string, CheckoutLocale> = {
  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', TL: 'pt', GW: 'pt', ST: 'pt',
  // Spanish
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', EC: 'es', VE: 'es',
  UY: 'es', PY: 'es', BO: 'es', CU: 'es', DO: 'es', GT: 'es', HN: 'es', NI: 'es',
  PA: 'es', SV: 'es', CR: 'es', GQ: 'es',
  // French
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', ML: 'fr', BF: 'fr',
  NE: 'fr', TD: 'fr', GA: 'fr', CG: 'fr', CD: 'fr', HT: 'fr',
  // German
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  // Italian
  IT: 'it', SM: 'it', VA: 'it',
  // English (everything else)
};

// ─── Locale → currency format locale ───────────────────────────────────────────

export const CURRENCY_LOCALES: Record<CheckoutLocale, string> = {
  en: 'en-US',
  pt: 'pt-PT',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
};
