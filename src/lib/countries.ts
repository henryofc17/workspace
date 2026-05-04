export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  // A
  { code: "AF", name: "Afganistán", flag: "🇦🇫" },
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "DE", name: "Alemania", flag: "🇩🇪" },
  { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AG", name: "Antigua y Barbuda", flag: "🇦🇬" },
  { code: "SA", name: "Arabia Saudita", flag: "🇸🇦" },
  { code: "DZ", name: "Argelia", flag: "🇩🇿" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaiyán", flag: "🇦🇿" },

  // B
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BD", name: "Bangladés", flag: "🇧🇩" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BH", name: "Baréin", flag: "🇧🇭" },
  { code: "BY", name: "Belarús", flag: "🇧🇾" },
  { code: "BE", name: "Bélgica", flag: "🇧🇪" },
  { code: "BZ", name: "Belice", flag: "🇧🇿" },
  { code: "BJ", name: "Benín", flag: "🇧🇯" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BA", name: "Bosnia y Herzegovina", flag: "🇧🇦" },
  { code: "BW", name: "Botsuana", flag: "🇧🇼" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "BN", name: "Brunéi", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", flag: "🇧🇮" },
  { code: "BT", name: "Bután", flag: "🇧🇹" },

  // C
  { code: "CV", name: "Cabo Verde", flag: "🇨🇻" },
  { code: "KH", name: "Camboya", flag: "🇰🇭" },
  { code: "CM", name: "Camerún", flag: "🇨🇲" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "TD", name: "Chad", flag: "🇹🇩" },
  { code: "CZ", name: "Chequia", flag: "🇨🇿" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CY", name: "Chipre", flag: "🇨🇾" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "KM", name: "Comoras", flag: "🇰🇲" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CI", name: "Costa de Marfil", flag: "🇨🇮" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HR", name: "Croacia", flag: "🇭🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },

  // D
  { code: "DK", name: "Dinamarca", flag: "🇩🇰" },
  { code: "DM", name: "Dominica", flag: "🇩🇲" },

  // E
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egipto", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "AE", name: "Emiratos Árabes Unidos", flag: "🇦🇪" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷" },
  { code: "SK", name: "Eslovaquia", flag: "🇸🇰" },
  { code: "SI", name: "Eslovenia", flag: "🇸🇮" },
  { code: "ES", name: "España", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "SZ", name: "Esuatini", flag: "🇸🇿" },
  { code: "ET", name: "Etiopía", flag: "🇪🇹" },

  // F
  { code: "PH", name: "Filipinas", flag: "🇵🇭" },
  { code: "FI", name: "Finlandia", flag: "🇫🇮" },
  { code: "FJ", name: "Fiyi", flag: "🇫🇯" },
  { code: "FR", name: "Francia", flag: "🇫🇷" },

  // G
  { code: "GA", name: "Gabón", flag: "🇬🇦" },
  { code: "GM", name: "Gambia", flag: "🇬🇲" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GD", name: "Granada", flag: "🇬🇩" },
  { code: "GR", name: "Grecia", flag: "🇬🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GN", name: "Guinea", flag: "🇬🇳" },
  { code: "GQ", name: "Guinea Ecuatorial", flag: "🇬🇶" },
  { code: "GW", name: "Guinea-Bisáu", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },

  // H
  { code: "HT", name: "Haití", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HU", name: "Hungría", flag: "🇭🇺" },

  // I
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IR", name: "Irán", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IE", name: "Irlanda", flag: "🇮🇪" },
  { code: "IS", name: "Islandia", flag: "🇮🇸" },
  { code: "MH", name: "Islas Marshall", flag: "🇲🇭" },
  { code: "SB", name: "Islas Salomón", flag: "🇸🇧" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italia", flag: "🇮🇹" },

  // J
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japón", flag: "🇯🇵" },
  { code: "JO", name: "Jordania", flag: "🇯🇴" },

  // K
  { code: "KZ", name: "Kazajistán", flag: "🇰🇿" },
  { code: "KE", name: "Kenia", flag: "🇰🇪" },
  { code: "KG", name: "Kirguistán", flag: "🇰🇬" },
  { code: "KI", name: "Kiribati", flag: "🇰🇮" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },

  // L
  { code: "LA", name: "Laos", flag: "🇱🇦" },
  { code: "LS", name: "Lesoto", flag: "🇱🇸" },
  { code: "LV", name: "Letonia", flag: "🇱🇻" },
  { code: "LB", name: "Líbano", flag: "🇱🇧" },
  { code: "LR", name: "Liberia", flag: "🇱🇷" },
  { code: "LY", name: "Libia", flag: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "LT", name: "Lituania", flag: "🇱🇹" },
  { code: "LU", name: "Luxemburgo", flag: "🇱🇺" },

  // M
  { code: "MK", name: "Macedonia del Norte", flag: "🇲🇰" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" },
  { code: "MY", name: "Malasia", flag: "🇲🇾" },
  { code: "MW", name: "Malawi", flag: "🇲🇼" },
  { code: "MV", name: "Maldivas", flag: "🇲🇻" },
  { code: "ML", name: "Malí", flag: "🇲🇱" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MA", name: "Marruecos", flag: "🇲🇦" },
  { code: "MU", name: "Mauricio", flag: "🇲🇺" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "FM", name: "Micronesia", flag: "🇫🇲" },
  { code: "MD", name: "Moldavia", flag: "🇲🇩" },
  { code: "MC", name: "Mónaco", flag: "🇲🇨" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },

  // N
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NR", name: "Nauru", flag: "🇳🇷" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NE", name: "Níger", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "NO", name: "Noruega", flag: "🇳🇴" },
  { code: "NZ", name: "Nueva Zelanda", flag: "🇳🇿" },

  // O
  { code: "OM", name: "Omán", flag: "🇴🇲" },

  // P
  { code: "NL", name: "Países Bajos", flag: "🇳🇱" },
  { code: "PK", name: "Pakistán", flag: "🇵🇰" },
  { code: "PW", name: "Palaos", flag: "🇵🇼" },
  { code: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "PG", name: "Papúa Nueva Guinea", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "PL", name: "Polonia", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },

  // Q
  { code: "QA", name: "Qatar", flag: "🇶🇦" },

  // R
  { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "CF", name: "República Centroafricana", flag: "🇨🇫" },
  { code: "KR", name: "República de Corea", flag: "🇰🇷" },
  { code: "CD", name: "República Democrática del Congo", flag: "🇨🇩" },
  { code: "KP", name: "República Democrática Popular de Corea", flag: "🇰🇵" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "RW", name: "Ruanda", flag: "🇷🇼" },
  { code: "RO", name: "Rumania", flag: "🇷🇴" },
  { code: "RU", name: "Rusia", flag: "🇷🇺" },

  // S
  { code: "WS", name: "Samoa", flag: "🇼🇸" },
  { code: "KN", name: "San Cristóbal y Nieves", flag: "🇰🇳" },
  { code: "SM", name: "San Marino", flag: "🇸🇲" },
  { code: "VC", name: "San Vicente y las Granadinas", flag: "🇻🇨" },
  { code: "LC", name: "Santa Lucía", flag: "🇱🇨" },
  { code: "ST", name: "Santo Tomé y Príncipe", flag: "🇸🇹" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SC", name: "Seychelles", flag: "🇸🇨" },
  { code: "SL", name: "Sierra Leona", flag: "🇸🇱" },
  { code: "SG", name: "Singapur", flag: "🇸🇬" },
  { code: "SY", name: "Siria", flag: "🇸🇾" },
  { code: "SO", name: "Somalia", flag: "🇸🇴" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "ZA", name: "Sudáfrica", flag: "🇿🇦" },
  { code: "SD", name: "Sudán", flag: "🇸🇩" },
  { code: "SS", name: "Sudán del Sur", flag: "🇸🇸" },
  { code: "SE", name: "Suecia", flag: "🇸🇪" },
  { code: "CH", name: "Suiza", flag: "🇨🇭" },
  { code: "SR", name: "Surinam", flag: "🇸🇷" },

  // T
  { code: "TH", name: "Tailandia", flag: "🇹🇭" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "TJ", name: "Tayikistán", flag: "🇹🇯" },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "TO", name: "Tonga", flag: "🇹🇴" },
  { code: "TT", name: "Trinidad y Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Túnez", flag: "🇹🇳" },
  { code: "TM", name: "Turkmenistán", flag: "🇹🇲" },
  { code: "TR", name: "Turquía", flag: "🇹🇷" },
  { code: "TV", name: "Tuvalu", flag: "🇹🇻" },

  // U
  { code: "UA", name: "Ucrania", flag: "🇺🇦" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistán", flag: "🇺🇿" },

  // V
  { code: "VU", name: "Vanuatu", flag: "🇻🇺" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Viet Nam", flag: "🇻🇳" },

  // Y
  { code: "YE", name: "Yemen", flag: "🇾🇪" },
  { code: "DJ", name: "Yibuti", flag: "🇩🇯" },

  // Z
  { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabue", flag: "🇿🇼" },
];

export function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name || code;
}

export function getCountryFlag(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.flag || "🏳️";
}
