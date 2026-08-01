# turkiye-suc-haritasi

Türkiye suç istatistikleri için etkileşimli ısı haritası React bileşeni.

> **Durum:** Geliştirme aşamasında (Aşama 4/5 tamamlandı). Açık tema, bölge
> detay paneli ve katlanabilir filtreler eklendi.

## Kurulum

```bash
npm install turkiye-suc-haritasi
```

## Hızlı başlangıç

```tsx
import { CrimeHeatMap, generateMockData } from 'turkiye-suc-haritasi';
import 'turkiye-suc-haritasi/style.css';

const veri = generateMockData({ seed: 1 });

<div style={{ height: 600 }}>
  <CrimeHeatMap data={veri.records} categories={veri.categories} />
</div>
```

Bileşen yüksekliği olan bir kapsayıcı bekler; haritayı o kapsayıcıya sığdırır.

`data` ve `categories` **referans kimliğine göre** karşılaştırılır — bunları
render içinde satır içi dizi olarak oluşturmayın, yoksa toplama indeksi her
render'da yeniden kurulur.

## Şu an neler var

| Alan | Ne işe yarar |
|---|---|
| `CrimeHeatMap` | İl ve ilçe düzeyinde etkileşimli ısı haritası, gösterge ve ipucu |
| `Sidebar`, `SearchBar`, `FilterBar` | Sıralı bölge listesi, Türkçe arama, yıl ve kategori filtreleri |
| `CategoryPieChart`, `TrendChart` | Kategori dağılımı ve yıllara göre eğilim |
| `CATEGORY_PALETTE`, `arcPath`, `linePath` | Doğrulanmış kategorik palet ve grafik geometrisi |
| `buildPopulationIndex`, `toPerCapita` | 100.000 kişi başına suç oranı |
| `RegionDetail` | Bölgeye tıklayınca açılan detay paneli: kategori tablosu, halka grafik ve yıllık eğilim |
| `buildIndex`, `rollup`, `rankRegions`, `diffRollups` | Suç kayıtlarını doğrular, filtreler ve bölge bazında toplar |
| `createColorScale`, `computeLegendBreaks` | Algısal olarak eşit aralıklı OKLab renk skalaları |
| `foldTurkish`, `compareTurkish`, `searchEntities` | Türkçe'ye duyarlı arama ve sıralama |
| `formatTrNumber`, `formatPercent`, `formatDelta` | Deterministik `tr-TR` sayı biçimlendirme |
| `createTurkeyProjection`, `cullFeatures` | Eşit alanlı harita projeksiyonu ve görünürlük filtresi |
| `getLevelFeatures` | Paketle gelen il/ilçe sınır verisi |
| `trStrings`, `mergeStrings` | Türkçe metin tablosu ve `strings` prop'u ile geçersiz kılma |
| `generateMockData` | Tohumlanmış, tekrarlanabilir örnek veri seti |

`core/` katmanı React'ten ve DOM'dan tamamen bağımsızdır ve %100 dal kapsamıyla
test edilir.

## Erişilebilirlik

Harita klavyeyle tam kullanılabilir: `Tab` haritaya odaklanır, ok tuşları
bölgeler arasında gezinir, `Enter` seçer, `Esc` seçimi kaldırır. Her bölge adını
ve değerini bildiren bir `role="img"` öğesidir; ipucu içeriği `aria-live` ile
ekran okuyuculara yansıtılır. `prefers-reduced-motion` her yerde geçerlidir.

Renk hiçbir zaman tek başına anlam taşımaz — sayı her zaman rengin yanındadır.

## Veri biçimi

```ts
interface CrimeRecord {
  year: number;        // 2023
  ilCode: string;      // "34" — plaka kodu, 2 hane
  ilceCode?: string;   // "3401" — ilçe kodu, 4 hane (aşağıdaki nota bakın)
  category: string;    // CrimeCategory.id ile eşleşmeli
  count: number;       // negatif olmayan tam sayı
}
```

> **İlçe kodları hakkında.** Paketle gelen sınır verisindeki ilçe kodları
> `{plaka}{sıra}` biçimindedir ve sıra, il içinde Türkçe alfabetik sıralamadan
> gelir. Bunlar **resmî TÜİK kimlikleri değildir** — ilçe sınırlarını TÜİK
> kodlarıyla eşleştiren kamuya açık bir veri kümesi yok. Elinizde gerçek TÜİK
> kodlu veri varsa bir eşleme tablosuna ihtiyacınız olur; ayrıntı için
> `scripts/README.md`.

Kayıtlar önceden toplanmış sayılardır; tekil olay kayıtları değildir.

**Geçersiz kayıtlar hata fırlatmaz** — atılır ve Türkçe uyarı olarak bildirilir.
Tek bir bozuk satır yüzünden sayfayı çökerten bir kütüphane kabul edilemez.

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
- **Isı her zaman ilçe sayılarından gelir.** Yakınlaştırma yalnızca hangi
  sınırların çizildiğini değiştirir: ülke görünümünde il sınırları, yakınlaşınca
  ilçe sınırları. Renk çözünürlüğü hiç değişmez, bu yüzden gösterge de her iki
  düzeyde aynı aralıkları gösterir — yakınlaştırırken ölçeğin altınızda kaymadığı
  anlamına gelir. İpucu, gördüğünüz sınırın birimini bildirir: ülke görünümünde il
  toplamı, yakınlaşınca ilçe toplamı.
  Veride ilçe kodu yoksa ısı il düzeyine düşer.
- **Kaydırma ve yakınlaştırma tek bir `transform` üzerinde.** Bulanıklık filtresi
  yalnızca veri, filtre veya düzey değiştiğinde yeniden çalışır — imleç
  hareketinde asla. Haritanın anlık hissetmesiyle ağır hissetmesi arasındaki fark
  budur.
- **Açık tema, tek tema.**
- **Harita rampası tek renktir, gökkuşağı değil.** Gökkuşağı rampasının
  kendiliğinden bir sıralaması yoktur — yeşilin camgöbeğinden "daha çok"
  olduğunu söyleyen hiçbir şey yoktur — bu yüzden her bölge için lejanda bakmak
  gerekir. Açık zeminde ise ara tonlar zeytin ve turkuaza düşüyor ve harita bir
  geçiş gibi değil, çamur gibi okunuyordu. `ember` ve `deepBlue` rampalarının
  her durağı OKLab açıklığında eşit adımlarla çözüldü; parlaklık 0,726'dan
  0,059'a tekdüze iniyor ve komşu her çift en az 1,33 kontrastla ayrılıyor.
- **`fit` ile kap doldurma.** Türkiye'nin sınır kutusu yaklaşık 2,3:1, tarayıcı
  penceresi ise nadiren 1,8:1'i geçer. `contain` (varsayılan) ülkenin tamamını
  gösterir ve artan ekseni boş bırakır; `fill` kabı kaplar ve doğu ile batı
  uçlarını kırpar. Dikey alan ancak yatay kırpmayla satın alınabildiği için
  bu bir tercih meselesidir.
- **İle tıklandığında hem yakınlaşır hem detay açılır.** Detay hedefi kendi
  düzeyini taşır; aksi hâlde yakınlaşmanın tetiklediği düzey değişimi, aynı
  tıklamanın az önce açtığı paneli kapatırdı.
- **Grafik renkleri seçilmedi, doğrulandı.** Sekiz renkli kategorik palet,
  panellerin gerçekte üzerine bindiği yüzeye (`#11172b`) karşı test edildi:
  açıklık bandı, kroma tabanı, komşu çiftlerde renk körlüğü ayrımı (en kötü
  ΔE 8,4), normal görüşte taban (19,3) ve 3:1 kontrast — hepsi geçiyor.
- **Renk kategoriye bağlıdır, sırasına değil.** Bir filtre bir kategoriyi
  kaldırdığında kalanlar yeniden boyanmaz; aksi hâlde grafik kendini yeniden
  etiketliyormuş gibi görünür.
- **Vurgu için ayrı, saydam bir katman.** Görünen renk sınırların ötesine
  taşacak şekilde bulanıklaştırılır; isabet testi bulanık katmanda yapılsaydı
  tam bulanıklık yarıçapı kadar yanılırdı.

## Örnek veri hakkında

`generateMockData` tamamen sentetik veri üretir. Gerçek hiçbir olguyu
tanımlamaz; yalnızca geliştirme, test ve dokümantasyon içindir.

## Lisans

MIT. Sınır verisi OpenStreetMap türevidir ve ODbL kapsamında atıf gerektirir;
ayrıntılar için `scripts/README.md`.
