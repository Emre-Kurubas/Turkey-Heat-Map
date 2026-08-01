# Sınır verisi oluşturma

Kaynak sınır verisini paketle birlikte dağıtılan sadeleştirilmiş TopoJSON'a
dönüştürür. Sınır verisi değiştiğinde elle çalıştırılır; `npm run build`
sürecinin parçası değildir.

    npm run build:geo -- --il kaynak/il.geojson --ilce kaynak/ilce.geojson

## Kaynak veri gereksinimleri

- Her `Feature` bir `id` taşımalı: il için 2 haneli plaka kodu (`"34"`),
  ilçe için 4 haneli TÜİK kodu (`"3401"`).
- Her `Feature` `properties.name` içinde Türkçe adı taşımalı, doğru
  yazımıyla (`Şanlıurfa`, `Sanliurfa` değil).
- 81 ilin tamamı bulunmalı ve her ilin en az bir ilçesi olmalı.

Kod eşleşmezse betik hata verip çıkar. Bu kasıtlıdır: eksik bir il haritada
delik açar, tanınmayan bir kod ise hiçbir zaman renklendirilemeyecek bir
bölge oluşturur. İkisi de üretimde sessizdir, burada ise görünür.

## Lisans

Varsayılan kaynak OpenStreetMap türevi veridir. OSM verisi **ODbL** ile
lisanslıdır ve **atıf zorunludur** — paket, harita köşesinde kaldırılamaz bir
atıf metni gösterir.

Sitede lisanslı HGM/TÜİK sınır verisi varsa o tercih edilmelidir; betik kaynak
bağımsızdır. Bu durumda ODbL atıf zorunluluğu ortadan kalkar.
