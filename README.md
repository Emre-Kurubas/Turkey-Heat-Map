# turkiye-suc-haritasi

Türkiye suç istatistikleri için etkileşimli ısı haritası React bileşeni.

> **Durum:** Geliştirme aşamasında. Paket henüz npm'e yayımlanmadı; aşağıdaki
> GitHub kurulumu şu an çalışan yoldur.

## Kurulum

Depodan doğrudan:

```bash
npm install github:Emre-Kurubas/Turkey-Heat-Map
```

npm'e yayımlandıktan sonra:

```bash
npm install turkiye-suc-haritasi
```

React 18 veya 19 bir **peer dependency**'dir; projenizde zaten kurulu olması
beklenir. Paket hem ESM hem CJS olarak gelir ve tip tanımlarını içerir.

### Sunucu tarafı işleme

Bileşen sunucuda güvenle işlenir: işleme sırasında `window`, `document` veya
`matchMedia`'ya dokunulmaz. Sunucuda kapsayıcının boyutu bilinemeyeceği için
harita "yükleniyor" durumunu basar ve istemcide ölçüldüğünde çizilir.

### Paket boyutu

İlk yük ~78 KB gzip. İlçe geometrisi (~76 KB gzip) ayrı bir parça olarak,
haritanın ilçe sınırlarına ihtiyacı olduğunda yüklenir — ayrıntı için aşağıdaki
tasarım kararlarına bakın.

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
| `Sidebar`, `YearScope`, `SearchBar`, `FilterBar` | Sol panel (iki grafik ve ilk 10 bölge), yıl aralığı, Türkçe arama, aranabilir suç türü filtresi |
| `CategoryPieChart`, `TrendChart` | Kategori dağılımı ve yıllara göre eğilim; `embedded` ile sol panele gömülür |
| `CATEGORY_PALETTE`, `arcPath`, `linePath` | Doğrulanmış kategorik palet ve grafik geometrisi |
| `buildPopulationIndex`, `toPerCapita` | 100.000 kişi başına suç oranı |
| `RegionDetail` | Bölgeye tıklayınca açılan detay paneli: iki grafik, ilde en çok kaydı olan ilçeler, ilçede suç türleri |
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

## Ölçek sınırları

Ölçülen sayılar, tahmin değil. 973 ilçe ve 10 yıl sabittir; ölçeklenen eksen suç
türü sayısıdır ve ikisiyle birden çarpılır.

| Kayıt | Kurulum (`buildIndex`, bir kez) | Filtre değişimi (3 geçiş) |
|---|---|---|
| 78 bin (8 tür) | ~55 ms | ~30 ms |
| 623 bin (64 tür) | ~420 ms | ~90 ms |
| 2,4 milyon (250 tür) | ~2,0 s | ~390 ms |

Maliyet doğrusaldır — kareye çıkan bir davranış yok — ama sabit çarpanlar 1
milyon kaydın üzerinde ana iş parçacığını gözle görülür biçimde kilitler.
Pratik tavsiye:

- **1 milyon kaydın altında** bileşen kendi başına yeterlidir.
- **Üstünde** veriyi sunucuda toplayıp bileşene önceden toplanmış hâlde verin
  (`CrimeRecord` zaten toplanmış sayılardır; daha kaba bir kırılımla vermek
  tamamen geçerlidir), ya da yalnızca ilgilenilen yılları gönderin.

Yıl aralığı daraltmak ölçüde **orantılı olarak** ucuzlar: kayıtlar kurulum
sırasında yıla göre gruplandığı için 10 yıldan 1'ini seçmek diğer 9 yılın
kayıtlarına hiç dokunmaz (2,4 milyon kayıtta 179 ms → 20 ms). Sayfadaki en sık
sürüklenen denetim yıl kaydırıcısı olduğu için optimizasyon oraya yapıldı.

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
- **İlçe geometrisi ayrı bir parça olarak, istendiğinde yüklenir.** 973 ilçenin
  kodu ve adı bileşen ilk bağlandığı anda gerekir — kayıtları doğrulamak, arama
  dizinini kurmak, ipucunu etiketlemek için — ama arkalarındaki 262 KB'lık yay
  verisi yalnızca harita ilçe sınırlarını gerçekten çizdiğinde gerekir. İkisi
  birlikte paketlenince ilk il boyanmadan önce hepsinin ayrıştırılması
  gerekiyordu. Artık adlar sabit olarak (17 KB), geometri ise dinamik `import`
  ile geliyor: ilk yük 148 KB gzip'ten 78 KB'a indi. Harita illeri hemen boyar
  ve parça geldiğinde ilçe çözünürlüğüne keskinleşir.
  Üç yer bu cevabı aynı anda bilmek zorunda — toplama düzeyi, yakınlaştırma
  düzeyi ve izdüşürülen geometri — çünkü biri "ilçe" derken diğeri "il" derse
  harita ilçe toplamlarını il şekillerine boyar ve tüm ülke "veri yok" olarak
  okunur. `useLoadedLevel` bu yüzden modül durumuna abone olur.
- **Bulanıklık yansıtma uzayında sabittir, ekran uzayında değil.** Önce
  yakınlaştırmaya bölünüyordu, yani ekranda hep aynı piksel sayısı kadar
  yumuşaktı; sonuç olarak yakınlaştıkça ısı keskinleşiyor ve ilçeler sert kenarlı
  düz çokgenlere dönüşüyordu — tam da ayrıntının bulunduğu ölçekte harita ısı
  haritası olmaktan çıkıyordu. Sabit tutulunca yumuşaklık bölgelerle orantılı
  kalır: bir ilçe, ülke görünümündeki kadar yumuşak görünür. Yan faydası,
  filtrenin girdilerinden `transform`'un tamamen çıkması — artık yakınlaştırma
  bulanıklığı hiç yeniden çalıştırmıyor.
- **Arama ve filtre satırı çerçeveye göre ortalanır, ızgara sütununa göre
  değil.** Izgara öğesiyken sol panelin artığı boşlukta ortalanıyordu, dolayısıyla
  paneli kapatmak arama kutusunu yana kaydırıyordu. Bu denetimlerin panelle hiçbir
  ilgisi yok; başka bir şeye dokununca yer değiştiren bir denetim, her seferinde
  yeniden aranan bir denetimdir.
- **Suç türü filtresi binlerce kategoriye göre tasarlandı.** Önceki hâli her
  kategori için bir çip basıyordu ve yalnızca örnek veride sekiz kategori olduğu
  için çalışıyordu. Gerçek suç sınıflandırmaları binlerce kalem içerir; o
  ölçekte bir çip sırası yavaş bir denetim değil, hiç denetim değildir. Yerine:
  arama kutusu, ve gösterilenin sıralanması. Sorgu yokken liste sayıya göre
  sıralanır — haritayı fiilen taşıyan türler en üstte. Sorgu varken arama
  çubuğunun kullandığı Türkçe duyarlı `scoreEntity` ile eşleşmeye göre sıralanır;
  `foldTurkish` sayesinde "HIRSIZLIK" da "Hırsızlık"ı bulur, `toLowerCase`
  bulamazdı. Liste 40 satırla sınırlıdır ve altındaki satır kaç sonucun
  çizilmediğini söyler: sessizce kısaltılmış bir liste, tam bir liste gibi
  okunur. Seçilenler arama kutusunun üstüne kaldırılabilir çip olarak sabitlenir
  — uzun bir listede seçim kaydırılıp gözden kaybolduğunda ya da bir sorgu onu
  gizlediğinde, kullanıcının ne seçtiğini görmesinin ve geri almasının başka
  yolu kalmaz.
- **Bölüm çizgileri sarmalayıcıda, bölümün kendisinde değil.** Sol paneldeki iki
  grafiğin kökü `flat` bir `GlassPanel` ve o da `border: 0` taşıyor — ayırıcı
  kuralla aynı özgüllükte. Çizgiyi doğrudan bölüme koymak, hangisinin kazanacağını
  paketleyicinin stil sayfalarını hangi sırayla yazdığına bırakır; halka grafiğin
  üstündeki çizginin bir görünüp bir kaybolmasının sebebi tam olarak buydu. Her
  bölüm ayrıca alttan ve üstten eşit doldurulur, böylece çizgi ayırdığı iki şeyin
  tam ortasına düşer.
- **Açık tema, tek tema.**
- **Harita rampası tayf rampasıdır: maviden kırmızıya.** Bu bilinçli bir
  takastır. Tek renkli bir rampa kendini yalnızca açıklıkla sıralar ve okuyucuya
  öğretilmesi gerekmez; tayf rampası bunu yapmaz, dolayısıyla yükü lejant
  taşır. Karşılığında komşu düzeyler çok daha kolay ayrışır — değerlerin büyük
  bölümünün alt uçta toplandığı 81 illik bir ülkede, açıklığın neredeyse aynı
  bıraktığı iki komşuyu renk ayırır. `SPECTRAL_STOPS` iki kuralla mudan korunur:
  renk açısı her adımda tek yönde ilerler (262°'den 31°'e, hiç geri dönmeden) ve
  hiçbir durağın kroması 0,10'un altına inmez, yani hiçbir renk "veri yok"
  dolgusuna doğru kaymaz. Bedeli açıklıktır: ortadaki sarı zemini yalnızca 1,27
  kontrastla geçer (uçlarda 4,21 ve 4,62). Büyüklük bu yüzden koyulukla değil
  renkle okunur — renk körlüğüne karşı güvenli seçenek olarak `deepBlue`
  rampası tam da bu nedenle duruyor.
- **Üç panel değil, tek bir sol panel.** Halka grafik sağ üstte, yıl grafiği
  sağ altta, bölge listesi solda duruyordu: aynı sayının üç ayrı kesiti,
  haritanın üç ayrı köşesinde. Hepsi 340 piksellik tek bir panelde toplandı ve
  sırası daralarak gidiyor — önce zamana göre (yıl grafiği), sonra yere göre
  (en çok kaydı olan 10 bölge), sonra türe göre (halka grafik ve anahtarı, yan
  yana). Panel bayrakları (`panels.pie`, `panels.trend`, `panels.sidebar`) hâlâ
  üçünü bağımsız açıp kapatıyor; artık ayrı kartları değil, ortak bir yüzeyin
  bölümlerini anahtarlıyorlar. Panel, üç bölümden en az biri açıksa görünür.
- **Detay paneli açılan düzeye göre değişir.** Şekli sol panelle aynı — yıl
  grafiği, sıralı bir liste, halka grafik — böylece bir bölgeye inmek okuyucunun
  öğrendiği düzeni bozmuyor. Yalnızca ortadaki bant düzeye göre değişiyor: bir
  ilin altında ilçeler var ve sıradaki asıl soru o, bu yüzden il paneli en çok
  kaydı olan 10 ilçeyi listeler ve satırları bir düzey aşağı iner. İlçenin
  altında bir şey yok, bu yüzden onun orta bandı suç türü tablosudur. İlçe
  payları ülke toplamına değil kendi iline göre hesaplanır; ulusal payda her
  satıra %0,4 yazdırır ve hiçbir şey söylemez.
- **Yıl aralığı haritanın sağ üstünde okunur ve oradan ayarlanır.** Filtre
  çekmecesinin bir bölümüydü; ama o cinsten bir filtre değil. Kategori filtreleri
  "yalnızca bunları göster" der, yıl aralığı ise ekrandaki her sayının neyi
  saydığına karar verir — dolayısıyla açılıp kapanan bir çekmecede değil, bir
  bakışta okunup açmadan kaydırılabilecek yerde durur. Kendi paneli var: basılan
  bir şey, ve hareketli bir ısı haritasının üzerinde yüzen bir kaydırıcının ne
  rayına sabit bir zemin ne de nerede bittiğini söyleyen bir kenarı olur. Tek
  yıllık seçim `2020–2020` değil, `2020` olarak yazılır: ilki okuyucuyu var
  olmayan bir ikinci yılı aramaya davet ediyor.
- **Kaydırma imleci değil, düğmeyi izler.** `pointerdown` anında tutamak
  `setPointerCapture` ile işaretçiyi üstlenir; sonraki her hareket ve bırakma
  imleç nerede olursa olsun ona gelir. Öncesinde dinleyici 20 piksellik rayın
  üzerindeydi ve `pointerleave` sürüklemeyi iptal ediyordu: imleç şeridin birkaç
  piksel dışına kayınca tutamak yerinde donuyordu. Konum hiçbir zaman geçiş
  (`transition`) ile yumuşatılmaz — tutamak, işaretçinin hareket ettiği karede
  imlecin altında olmak zorunda; yumuşatmak sürüklemeyi elden geri kalıyormuş
  gibi hissettirir.
- **Yıl grafiği kendi seçimiyle filtrelenmez.** Grafik, yıl filtresini *kuran*
  denetimdir. Filtrenin daralttığı bir seriyle beslenseydi 2020 seçildiğinde
  elinde tek bir nokta kalırdı — ne 2021'e geçmek ne de geri dönmek için
  tıklanacak bir şey olurdu. Bu yüzden `totalsByYear` yıl aralığını hiç okumaz;
  kategori ve bölge filtreleri uygulanır, çünkü onlar nelerin sayıldığını
  daraltır, hangi yılların sunulduğunu değil. Seçili yıla ikinci kez tıklamak
  aralığı tüm veriye geri açar.
- **Sol panel kapanınca yalnızca kulpu kalır.** Kulp panelin başlığında
  duruyordu, yani paneli kapatmak geri getirecek düğmeyi de ekrandan çıkarıyordu.
  Artık panelin dışında, rayın sağ kenarına sabitli: panel negatif kenar boşluğu
  ile kendi sütunundan çıkıp kayarken ray sıfıra iner ve `left: 100%` kulpu
  haritanın kenarına yürütür. Panel DOM'da kalır (yoksa geri dönerken canlanacak
  bir şey olmazdı) ama `visibility` kaydırma bitince kapanır, dolayısıyla ne sekme
  sırasında ne de erişilebilirlik ağacında görünür.
- **İlçelere inildiğinde ilin sınırı çift çizgiyle çizilir.** Yakınlaşınca il
  sınırları çizilmiyor ve ilçe ağı sınırın iki yanında aynı görünüyor — okuyucu
  nerede olduğunu yitiriyor. Geri konan tek çizgi, aynı mürekkeple çizilmiş kalın
  bir çizgi olsaydı ağın bir üyesi gibi okunurdu; altındaki açık renk kılıf onu
  ağdan ayırıyor. Hangi il olduğu seçimden değil açık detay panelinden gelir:
  seçimi zaten o inişin tetiklediği düzey değişimi temizliyor.
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
