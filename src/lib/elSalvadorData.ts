export interface SalvadoranDepartment {
  name: string;
  municipalities: string[];
}

export const SALVADORAN_DEPARTMENTS: SalvadoranDepartment[] = [
  {
    name: 'San Salvador',
    municipalities: [
      'San Salvador',
      'Soyapango',
      'Mejicanos',
      'Apopa',
      'Ilopango',
      'San Marcos',
      'Ciudad Delgado',
      'Cuscatancingo',
      'San Martín',
      'Tonacatepeque',
      'Ayutuxtepeque',
      'Panchimalco',
      'Nejapa',
      'Guazapa',
      'Santo Tomás',
      'Santiago Texacuangos',
      'Rosario de Mora',
      'El Paisnal',
      'Aguilares'
    ]
  },
  {
    name: 'La Libertad',
    municipalities: [
      'Santa Tecla',
      'Antiguo Cuscatlán',
      'Colón',
      'San Juan Opico',
      'Quezaltepeque',
      'Ciudad Arce',
      'Zaragoza',
      'San José Villanueva',
      'Huizúcar',
      'Nuevo Cuscatlán',
      'La Libertad',
      'San Pablo Tacachico',
      'Comasagua'
    ]
  },
  {
    name: 'Santa Ana',
    municipalities: ['Santa Ana', 'Chalchuapa', 'Metapán', 'Coatepeque', 'El Congo', 'Candelaria de la Frontera', 'Texistepeque']
  },
  {
    name: 'San Miguel',
    municipalities: ['San Miguel', 'Chinameca', 'Ciudad Barrios', 'Moncagua', 'Chapeltique', 'Sesori', 'Uluazapa']
  },
  {
    name: 'Sonsonate',
    municipalities: ['Sonsonate', 'Izalco', 'Acajutla', 'Nahuizalco', 'Armenia', 'Juayúa', 'Sonzacate']
  },
  {
    name: 'Ahuachapán',
    municipalities: ['Ahuachapán', 'Atiquizaya', 'Tacuba', 'Apaneca', 'Guaymango', 'Concepción de Ataco']
  },
  {
    name: 'Usulután',
    municipalities: ['Usulután', 'Jiquilisco', 'Santiago de María', 'Berlín', 'Puerto El Triunfo', 'Ozatlán']
  },
  {
    name: 'La Paz',
    municipalities: ['Zacatecoluca', 'San Luis Talpa', 'Olocuilta', 'San Juan Nonualco', 'Santiago Nonualco', 'San Pedro Masahuat']
  },
  {
    name: 'Cuscatlán',
    municipalities: ['Cojutepeque', 'Suchitoto', 'San Pedro Perulapán', 'San Martín', 'San Rafael Cedros']
  },
  {
    name: 'Chalatenango',
    municipalities: ['Chalatenango', 'Nueva Concepción', 'La Palma', 'Tejutla', 'Dulce Nombre de María', 'San Ignacio']
  },
  {
    name: 'Cabañas',
    municipalities: ['Sensuntepeque', 'Ilobasco', 'Victoria', 'San Isidro', 'Tejutepeque']
  },
  {
    name: 'San Vicente',
    municipalities: ['San Vicente', 'Tecoluca', 'Apastepeque', 'San Sebastián', 'Guadalupe']
  },
  {
    name: 'Morazán',
    municipalities: ['San Francisco Gotera', 'Jocoaitique', 'Perquín', 'Corinto', 'Sociedad', 'Osicala']
  },
  {
    name: 'La Unión',
    municipalities: ['La Unión', 'Santa Rosa de Lima', 'Pasaquina', 'Conchagua', 'Anamorós', 'San Alejo']
  }
];

export const SALVADORAN_BANKS = [
  'BAC Credomatic El Salvador',
  'Banco Agrícola',
  'Banco Cuscatlán',
  'Banco Davivienda El Salvador',
  'Banco Promerica El Salvador',
  'Banco CITI El Salvador',
  'Banco Hipotecario',
  'Banco de Fomento Agropecuario (BFA)',
  'Banco Azul',
  'Abank'
];

export const COMPANY_INFO_SV = {
  name: 'Ariannys Bazar El Salvador',
  businessName: 'Ariannys Bazar S.A. de C.V.',
  nrc: '298341-7',
  nit: '0614-150992-102-4',
  giro: 'Venta de Ropa, Calzado, Perfumería, Artículos de Bazar y Novedades al por Mayor y Menor',
  address: 'Av. Roosevelt y 55 Av. Norte, C.C. Galerías / Metrocentro, San Salvador, El Salvador',
  phone: '+503 2245-8890 / +503 7890-1234',
  email: 'ventas@ariannysbazar.sv',
  country: 'El Salvador',
  currency: 'USD',
  currencySymbol: '$',
  ivaRate: 0.13, // 13% IVA
  retentionRate: 0.01 // 1% Retención IVA Grandes Contribuyentes
};

// Formatea números telefónicos salvadoreños al formato estándar nacional (+503 XXXX-XXXX)
export function formatSalvadoranPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('503') && cleaned.length >= 11) {
    const main = cleaned.slice(3, 11);
    return `+503 ${main.slice(0, 4)}-${main.slice(4)}`;
  }
  if (cleaned.length === 8) {
    return `+503 ${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return phone;
}

// Valida y formatea el Documento Único de Identidad de El Salvador DUI (00000000-0)
export function formatDUI(dui: string): string {
  const cleaned = dui.replace(/\D/g, '').slice(0, 9);
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8)}`;
  }
  return dui;
}

// Valida y formatea el NIT tradicional de 14 dígitos (0000-000000-000-0) o de 9 dígitos homologado con DUI
export function formatNIT(nit: string): string {
  const cleaned = nit.replace(/\D/g, '');
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10, 13)}-${cleaned.slice(13)}`;
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8)}`;
  }
  return nit;
}
