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
  },
  filters: {
    title: 'Filtreler',
    yearRange: 'Yıl aralığı',
    categories: 'Suç türü',
    reset: 'Sıfırla',
    perCapita: 'Nüfusa göre',
    allCategories: 'Tümü',
    selectedSuffix: 'seçili',
    searchCategories: 'Suç türü ara…',
    noCategoryMatch: 'Eşleşen suç türü yok',
    moreCategories: 'sonuç daha — aramayı daraltın',
    removeCategory: 'kaldır',
    clearCategories: 'Seçimi temizle',
    open: 'Filtreleri aç',
    close: 'Filtreleri kapat',
  },
  detail: {
    close: 'Detayı kapat',
    total: 'Toplam',
    categories: 'Suç türleri',
    districts: 'En çok kaydı olan ilçeler',
    noChildren: 'Bu il için ilçe kaydı yok',
    empty: 'Bu bölge için kayıt yok',
  },
  pie: {
    title: 'Suç türü dağılımı',
    national: 'Türkiye geneli',
    other: 'Diğer',
    expand: 'tümünü göster',
    collapse: 'Diğer kategorileri gizle',
    empty: 'Veri yok',
  },
  trend: {
    title: 'Yıllara göre',
    empty: 'Veri yok',
    year: 'Yıl',
  },
  sidebar: {
    title: 'Türkiye',
    collapse: 'Listeyi daralt',
    expand: 'Listeyi genişlet',
    empty: 'Gösterilecek bölge yok',
    topList: 'En çok kaydı olan bölgeler',
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
