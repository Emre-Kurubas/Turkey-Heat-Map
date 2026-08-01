# turkiye-suc-haritasi

Türkiye suç istatistikleri için etkileşimli ısı haritası React bileşeni.

> **Durum:** Geliştirme aşamasında (Aşama 1/5 tamamlandı). Bu sürüm yalnızca saf
> hesaplama katmanını (`core/`) içerir; React bileşenleri henüz yayınlanmadı.

## Kurulum

```bash
npm install turkiye-suc-haritasi
```

## Şu an neler var

React'ten ve DOM'dan tamamen bağımsız, saf yardımcılar — hepsi %100 dal
kapsamıyla test edilmiş durumda:

| Alan | Ne işe yarar |
|---|---|
| `buildIndex`, `rollup`, `rankRegions`, `diffRollups` | Suç kayıtlarını doğrular, filtreler ve bölge bazında toplar |
| `createColorScale`, `computeLegendBreaks` | Algısal olarak eşit aralıklı OKLab renk skalaları |
| `foldTurkish`, `compareTurkish`, `searchEntities` | Türkçe'ye duyarlı arama ve sıralama |
| `formatTrNumber`, `formatPercent`, `formatDelta` | Deterministik `tr-TR` sayı biçimlendirme |
| `createTurkeyProjection`, `cullFeatures` | Eşit alanlı harita projeksiyonu ve görünürlük filtresi |
| `generateMockData` | Tohumlanmış, tekrarlanabilir örnek veri seti |

## Veri biçimi

```ts
interface CrimeRecord {
  year: number;        // 2023
  ilCode: string;      // "34" — plaka kodu, 2 hane
  ilceCode?: string;   // "3401" — TÜİK ilçe kodu, 4 hane
  category: string;    // CrimeCategory.id ile eşleşmeli
  count: number;       // negatif olmayan tam sayı
}
```

Kayıtlar önceden toplanmış sayılardır; tekil olay kayıtları değildir.

**Geçersiz kayıtlar hata fırlatmaz** — atılır ve Türkçe uyarı olarak bildirilir.
Tek bir bozuk satır yüzünden sayfayı çökerten bir kütüphane kabul edilemez.

## Hızlı başlangıç

```ts
import {
  buildIndex, rollup, rankRegions, createColorScale, generateMockData,
} from 'turkiye-suc-haritasi';

const { records, categories } = generateMockData();
const index = buildIndex({ data: records, categories });

const sonuc = rollup(index, 'il', { yearRange: [2020, 2024], categories: [] });
const skala = createColorScale({ values: sonuc.values, mode: 'quantile', ramp: 'spectral' });

for (const bolge of rankRegions(sonuc, { sort: 'total-desc', names })) {
  console.log(bolge.rank, bolge.name, bolge.total, skala(bolge.total));
}
```

## Tasarım kararları

- **Eşit alanlı projeksiyon.** Koroplet harita büyüklüğü alan üzerinden renkle
  kodlar; alanı bozan bir projeksiyon ülkenin ne kadarının etkilendiğini
  sistematik olarak yanlış gösterir.
- **Varsayılan `quantile` renk skalası.** Türkiye suç verisi birkaç büyükşehrin
  hâkimiyetindedir; doğrusal bir skalada kalan ~78 il görsel olarak
  ayırt edilemez hale gelir. Lejant hangi modun etkin olduğunu daima belirtir.
- **`Intl` yerine elle yazılmış biçimlendirme.** Bazı Node sürümleri small-icu
  ile gelir ve `tr-TR` sessizce `en-US`'e düşerek `1.234.567` yerine
  `1,234,567` üretir.
- **`toLowerCase()` yerine `foldTurkish`.** Yerleşik dönüşüm noktalı/noktasız
  İ/I çiftinde hatalıdır ve aramayı sessizce bozar.

## Örnek veri hakkında

`generateMockData` tamamen sentetik veri üretir. Gerçek hiçbir olguyu
tanımlamaz; yalnızca geliştirme, test ve dokümantasyon içindir.

## Lisans

MIT. Sınır verisi OpenStreetMap türevidir ve ODbL kapsamında atıf gerektirir;
ayrıntılar için `scripts/README.md`.
