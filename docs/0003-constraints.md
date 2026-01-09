# EK B: Sistem Kısıtları ve Savunma Analizi

## System Constraints, Edge Cases, and Design Defense

Bu döküman, **Conditioned Deterministic Orchestration (CDO)** modelinin teorik sınırlarını, potansiyel kör noktalarını (blind spots) ve bu durumlara karşı geliştirilen mimari savunma mekanizmalarını ele alır.

Amaç, sistemin sadece ideal koşullarda değil, belirsizlik ve anomaliler karşısında nasıl davranacağını formüle etmektir.

---

### 1. Bayat Veri Paradoksu (The Staleness Problem)

**Risk:** "Sessiz Ölüm" (Silent Death)
Matematiksel modelde yer alan Entropi ($\lambda$) faktörü, zamanla sistemdeki basıncı düşürür (soğutur). Eğer bir düğüm (node) arızalanır ve telemetri göndermeyi tamamen keserse, sistem bu sessizliği "iyileşme" olarak yorumlayabilir. Basınç sıfıra yaklaşır, direnç düşer ve trafik ölü düğüme yönlendirilir.

**Savunma Mekanizması: Belirsizlik Maliyeti**
Empedans formülüne, verinin tazeliğine bağlı bir **Belirsizlik (Uncertainty)** terimi eklenmelidir.

$$
R_{total}(t) = R_{phys} + U(t)
$$

Burada $U(t)$, son veri alınan zamandan ($t_{last}$) bu yana geçen süre ile doğru orantılı olarak artar:

$$
U(t) = \kappa \cdot (t_{current} - t_{last\_seen})
$$

* **Sonuç:** Veri akışı kesilen bir düğümün direnci, iyileşmek yerine zamanla sonsuza gider. Sistem, hakkında bilgi sahibi olmadığı (karanlıkta kalan) yolları riskli kabul eder ve kapatır.

---

### 2. "Kara Delik" Düğümler (The Black Hole Anomaly)

**Risk:** "Hızlı ama Yanlış" (Fast but Wrong)
Bir servis, uygulama hatası nedeniyle gelen istekleri işlemeden anında `200 OK` (veya boş yanıt) dönebilir. Bu durumda Latency $\approx 0$ ve Error Rate $= 0$ olur. Vektörel basınç modeli, bu düğümü "mükemmel performansta" sanarak tüm trafiği buraya yığabilir.

**Savunma Mekanizması: Alt Sınır ve Semantik Ayrım**
CDO, bir taşıma katmanı (transport layer) disiplinidir; uygulama semantiğini (cevap doğru mu?) doğrulamaz. Ancak, "Fiziksel İmkansızlık" tespiti yapılabilir.

1. **Minimum Latency Threshold:** İşlem süresi fiziksel olarak mümkün olmayan (örn. $< 1ms$ network süresi dahil) yanıtlar, "başarı" değil "anomali" olarak işaretlenir.
2. **Anomaly Detection:** Bir düğümün istatistikleri, kümenin geri kalanından (peer nodes) standart sapma ($\sigma$) olarak aşırı ayrışıyorsa, o düğümün direnci tedbiren artırılır.

---

### 3. Parametre Hassasiyeti (Parameter Sensitivity)

**Risk:** "Sihirli Sayılar" (Magic Numbers)
Modeldeki Çürüme ($\lambda$), Sönümleme ($\mu$) ve Skar ($\sigma$) katsayıları yanlış seçilirse sistem kararsızlığa (osilasyon) veya aşırı tutuculuğa (starvation) sürüklenebilir. "Herkes için tek doğru" bir konfigürasyon yoktur.

**Savunma Mekanizması: Adaptif Tuning**
Bu değerler statik sabitler (const) olarak değil, dinamik değişkenler olarak tasarlanmıştır. Gelecek çalışmalarda (Future Work), bu parametrelerin çalışma zamanında optimize edilmesi hedeflenmektedir:

* **Simülasyon Tabanlı Genetik Algoritmalar:** Sistemin ideal sönümleme katsayılarını bulmak için kapalı devre simülasyonlar kullanılır.
* **PID Auto-Tuning:** Endüstriyel kontrolcülerde olduğu gibi, sistem kendi osilasyon periyodunu ölçerek $\mu$ (damping) değerini otomatik sıkılaştırıp gevşetebilir.

---

### 4. Enerji Verimliliği ve Sürdürülebilirlik (Green Computing)

**Fırsat:** "İşlem İsrafının Önlenmesi"
Geleneksel "Retry" mekanizmaları, başarısız olacağı belli olan işlemleri tekrar tekrar deneyerek CPU döngülerini ve elektrik enerjisini boşa harcar (Computation Waste).

**CDO Yaklaşımı:**
Momentum tabanlı direnç sayesinde sistem, hataya giden bir yolu **istek daha yola çıkmadan** (source) sönümler.

* **Fayda:** Başarısızlık maliyeti, ağa ve işlemciye yük binmeden "karar anında" elenir.
* **Sonuç:** Bu mimari, sadece yüksek erişilebilirlik (Availability) değil, aynı zamanda **Karbon Ayak İzi Düşük (Low Carbon Footprint)** bir yazılım operasyonu vaat eder.

---

### 5. Ölçeklenebilirlik Sınırları (Scalability Limits)

**Kısıt:** Durum Senkronizasyonu
Merkezi olmayan (Decentralized) karar mekanizması, her düğümün kendi yerel "gerçeğine" dayanır. Çok büyük kümelerde (1000+ node), düğümlerin sistem hakkındaki algısı (subjektif determinizm) birbirinden çok farklılaşabilir.

**Savunma:**
Sistem "Global Consistency" (Küresel Tutarlılık) vaat etmez; "Local Stability" (Yerel Kararlılık) vaat eder. Sistemin toplam davranışı, yerel kararlı yapıların toplamından (Emergent Behavior) oluşur. Bu, CAP teoreminin AP (Availability + Partition Tolerance) tarafında bilinçli bir tercihtir.
