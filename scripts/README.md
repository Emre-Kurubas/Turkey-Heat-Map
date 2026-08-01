# Sınır verisi oluşturma

Kaynak sınır verisini paketle birlikte dağıtılan sadeleştirilmiş TopoJSON'a
dönüştürür. Sınır verisi değiştiğinde elle çalıştırılır; `npm run build`
sürecinin parçası değildir. Üretilen TopoJSON depoya işlenir — asıl ürün odur,
bu betikler onu yeniden üretme yoludur.

## İki adım

    # 1) Ham kaynağı kodlanmış GeoJSON'a çevir
    npm run prepare:geo -- --il-src ham/adm1.geojson --ilce-src ham/adm2.geojson --out ham/

    # 2) Sadeleştirilmiş TopoJSON üret
    npm run build:geo -- --il ham/il.geojson --ilce ham/ilce.geojson

## Kaynak veri

Şu an kullanılan kaynak [geoBoundaries](https://www.geoboundaries.org) `gbOpen`
sürümüdür (TUR ADM1 ve ADM2, `9469f09`):

    https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM1/geoBoundaries-TUR-ADM1.geojson
    https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM2/geoBoundaries-TUR-ADM2.geojson

İki düzey de aynı kaynaktan ve aynı sürümden gelir; bu yüzden ilçe sınırları il
sınırlarının içine düzgün oturur ve mekânsal eşleme güvenilir olur.

### Betiğin beklediği biçim

- Her `Feature` bir `id` taşımalı: il için 2 haneli plaka kodu (`"34"`),
  ilçe için 4 haneli kod (`"3401"`).
- Her `Feature` `properties.name` içinde Türkçe adı taşımalı, doğru
  yazımıyla (`Şanlıurfa`, `Sanliurfa` değil).
- 81 ilin tamamı bulunmalı ve her ilin en az bir ilçesi olmalı.

Kod eşleşmezse betik hata verip çıkar. Bu kasıtlıdır: eksik bir il haritada
delik açar, tanınmayan bir kod ise hiçbir zaman renklendirilemeyecek bir
bölge oluşturur. İkisi de üretimde sessizdir, burada ise görünür.

## `prepare-geo-source.ts` ne yapar

Kaynakta doğru Türkçe adlar ve temiz geometri var, ama **idari kod yok**. Üç iş
yapılır:

1. **İl kodlama.** İl adları `region-meta.ts` içindeki kanonik adlarla birebir
   eşleştirilir. Bulanık eşleme yoktur: `Afyon` ya da `İçel` gibi eski adlar
   sessizce kabul edilirse veri hiçbir zaman tutmaz.
2. **Mekânsal eşleme.** İlçeler adla değil, geometriyle ile bağlanır. İlçe adları
   benzersiz değildir — `Yenişehir` üç, `Kale` ve `Gölbaşı` ikişer kez geçer.
   Her ilçenin içinde kaldığı garanti bir noktası hesaplanır ve hangi ilin
   poligonuna düştüğüne bakılır. Hiçbir ile düşmeyen ilçe olursa betik durur;
   "en yakın il" tahmini yapılmaz.
3. **Ad düzeltme.** Merkez ilçeler kaynakta tutarsız adlandırılmış
   (`Adıyaman merkez`, `Bilecik (merkez)`, `Afyonkarahisar (Merkez İlçe)`,
   `Rize merkezi`, `Giresun District`, `Ardahan`). Hepsi `Merkez` yapılır —
   51 il, yani büyükşehir olmayan illerin tamamı. `Prince Islands` → `Adalar`.
   Denizli'nin `Merkezefendi` ve Kütahya'nın `Gediz` ilçeleri korunur.

### İlçe kodları hakkında — önemli

Üretilen ilçe kodu `{plaka}{sıra}` biçimindedir; sıra, il içinde Türkçe alfabetik
sıralamadan gelir (`3401` = İstanbul/Adalar). **Bu kod resmî bir TÜİK kimliği
değildir.** İlçe sınırlarını TÜİK kodlarıyla eşleştiren kamuya açık bir veri
kümesi yok.

Kod, `ilCodeFromIlceCode`'un dayattığı sözleşmeye uyar (4 hane, ilk ikisi plaka
kodu) ve çalıştırmalar arasında kararlıdır, yani harita ile `region-meta` her
zaman aynı şeyi söyler. Ancak elinde **gerçek TÜİK kodlu veri olan bir
tüketicinin bir eşleme tablosuna ihtiyacı olur.** Resmî sınır verisi
(HGM/TÜİK) sağlanırsa bu sorun tümüyle ortadan kalkar.

## Sarım yönü (winding order) tuzağı

`build-geo.ts` her poligonu yazmadan önce yeniden sarar: **dış halkalar saat
yönünde**, delikler ters yönde. Bu, RFC 7946'nın tersidir — ama veriyi çizen
`d3-geo` o RFC'den eskidir ve onu benimsemez.

Yanlış sarılmış bir dış halkayı `d3-geo` kendi alanının *tümleyeni* olarak
okur: yani bölge yerine "yeryüzünün geri kalanı". Sonuç sessiz ve yıkıcıdır —
`geoBounds` tüm dünyayı döndürür, `fitExtent` Türkiye'yi birkaç piksele
küçültür, `geoContains` her noktayı eşleştirir. Ankara çevresinde 1°'lik bir
kare, doğru sarımla 2,35e-4 sterradyan, yanlış sarımla 12,566 — yani kürenin
tamamı — ölçer.

Sadeleştirme sonrası sıfır alanlı hâle gelen küçük ada ve halkalar da
`filterAttachedWeight` ile atılır; sıfır alanlı bir halkanın anlamlı bir sarım
yönü yoktur ve aynı hesapları bozar.

## Boyut bütçesi

Tasarım belgesi §9 sıkıştırılmış toplam için 120 KB tavan koyar. Şu anki
ayarlar (`il`: ağırlık 1e-4, `ilce`: 3e-4, ikisi de 1e4 nicemleme):

| Düzey | Ham | Gzip |
|---|---|---|
| il | 82 KB | 27 KB |
| ilçe | 262 KB | 71 KB |
| **toplam** | | **98 KB** |

Sadeleştirme, nicemlemeden **önce** çalışmalıdır: `presimplify` üçgen alanlarını
ölçmek için mutlak koordinat ister ve önceden uygulanmış nicemlemeyi atar.

## Lisans

Kaynak OpenStreetMap türevidir (geoBoundaries ADM1 CC-BY-SA 2.0, ADM2 ODbL 1.0).
İkisi de **atıf zorunludur** — paket, harita köşesinde kaldırılamaz bir atıf
metni gösterir:

    © OpenStreetMap katkıcıları — sınır verisi geoBoundaries (ODbL)

Sitede lisanslı HGM/TÜİK sınır verisi varsa o tercih edilmelidir; betik kaynak
bağımsızdır. Bu durumda hem ODbL atıf zorunluluğu hem de yukarıdaki ilçe kodu
sorunu ortadan kalkar.
