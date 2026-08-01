import type { Strings } from './types.js';

export const trStrings: Strings = {
  map: {
    label: 'Türkiye suç haritası',
    loading: 'Harita yükleniyor…',
    zoomIn: 'Yakınlaştır',
    zoomOut: 'Uzaklaştır',
    resetView: 'Görünümü sıfırla',
  },
  level: {
    il: 'İl',
    ilce: 'İlçe',
  },
  legend: {
    title: 'Ölçek',
    noData: 'Veri yok',
    scaleNote: 'Renk sıralamayı, sayı büyüklüğü gösterir.',
  },
  filters: {
    title: 'Filtreler',
    yearRange: 'Yıl aralığı',
    categories: 'Suç türü',
    reset: 'Sıfırla',
    perCapita: 'Nüfusa göre',
    allCategories: 'Tümü',
  },
  pie: {
    title: 'Suç türü dağılımı',
    national: 'Türkiye geneli',
    other: 'Diğer',
    expand: 'tümünü göster',
    collapse: 'Diğer kategorileri gizle',
    empty: 'Veri yok',
  },
  trend: { title: 'Yıllara göre', empty: 'Veri yok', year: 'Yıl' },
  sidebar: {
    title: 'Bölgeler',
    collapse: 'Listeyi daralt',
    expand: 'Listeyi genişlet',
    sortByTotal: 'Sayıya göre sırala',
    sortByName: 'Ada göre sırala',
    empty: 'Gösterilecek bölge yok',
  },
  search: {
    label: 'Ara',
    placeholder: 'İl, ilçe, suç türü veya yıl ara…',
    noResults: 'Sonuç bulunamadı',
    groups: { il: 'İl', ilce: 'İlçe', category: 'Suç Türü', year: 'Yıl' },
  },
  scaleMode: {
    linear: 'Doğrusal',
    log: 'Logaritmik',
    quantile: 'Yüzdelik',
  },
  tooltip: {
    title: (regionName) => regionName,
    total: 'Toplam',
    noData: 'Veri yok',
    topCategories: 'En çok görülen',
    yearOverYear: 'Geçen yıla göre',
  },
  attribution: {
    text: '© OpenStreetMap katkıcıları — sınır verisi geoBoundaries (ODbL)',
    label: 'Harita veri kaynağı',
  },
  error: {
    title: 'Harita yüklenemedi',
    body: 'Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin.',
  },
};
