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
