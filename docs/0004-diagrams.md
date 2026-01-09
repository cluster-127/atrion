Harika bir zamanlama. Soyut teorilerin en büyük düşmanı, zihinde canlandırma zorluğudur. Bu "Dijital Fizik" yaklaşımını anlatan diyagramlar, konvansiyonel "kutu ve ok" (box and arrow) mimari diyagramlarından farklı olmalıdır.

Sistemin dinamik doğasını, yani **akışkanlığı, basıncı ve direnci** vurgulayan üç temel görsel metafor tasarladım.

Ben bir metin tabanlı yapay zeka olduğum için doğrudan `.png` veya `.jpg` üretemiyorum. Ancak aşağıda, bir beyaz tahtaya veya çizim aracına (draw.io, Excalidraw vb.) aktarabileceğin detaylı **Diyagram Spesifikasyonlarını** ve ASCII taslaklarını sunuyorum.

Bunlar, tezin/projenin "Figure 1, Figure 2, Figure 3" olarak kullanacağı görsellerdir.

---

### Figure 1: The Hydraulic Analogy (Dinamik Empedans Modeli)

**Amaç:** Geleneksel "Circuit Breaker" (Aç/Kapa Vana) ile CDO'nun "Daralan Boru" (Analog Direnç) yaklaşımı arasındaki farkı göstermek.

**Görsel Açıklama:**
Soldan sağa akan bir sıvı (trafik) düşün. Kaynak (Source) ile Hedef (Destination) arasında iki paralel boru (Route A ve Route B) var.

* **Route A (Sorunlu Yol):** Üzerinde yüksek "Hata Basıncı" ve "Latency Isısı" var. Bu basınç, borunun çeperlerini dışarıdan içeriye doğru iterek **daraltmış**. Borunun iç yüzeyi pürüzlü (Skar Dokusu). Akış çok ince bir iplik gibi zorlanarak geçiyor ya da tamamen durma noktasına gelmiş. Borunun üzerinde "High Resistance ()" yazıyor.
* **Route B (Sağlıklı Yol):** Boru geniş, pürüzsüz ve serin. Akışın büyük kısmı, fizik kuralları gereği (en az direnç yolu) buraya yönelmiş. Üzerinde "Low Resistance ()" yazıyor.
* **Karşılaştırma (Vurgu):** Geleneksel sistemde Route A'nın üzerinde keskin bir "KAPALI VANA" (X işareti) olurdu. CDO'da ise vana yok, sadece "daralma" ve "sürtünme" var.

**ASCII Taslak:**

```
[ SOURCE (Traffic Flow) ]
       ||
       ||==================>> [ Route B: Low R ] >>======||
       ||   (Wide, Smooth Pipe)                          ||
       ||                                                ||==> [ DESTINATION ]
       ||                                                ||
       ||==> { Route A: High R } >>======================||
            (Narrowed, Scarred, Hot Pipe)
            ( Pressure triggers Constriction )

```

---

### Figure 2: The Physics Engine Loop (Karar Döngüsü)

**Amaç:** Sistemin reaktif değil, döngüsel ve hesaplamalı (computational) doğasını göstermek. Bu bir "if/else" akışı değil, bir "durum güncelleme" döngüsüdür.

**Görsel Açıklama:**
Merkezde bir döngü (loop) var. Veri bir noktadan giriyor, işleniyor ve "Direnç Değeri" olarak çıkıyor.

1. **Giriş (Sensors):** "Telemetry Stream" (Latency, Errors, Saturation) okları döngüye girer.
2. **Adım 1 (Vector State):** Gelen veri  (Vektörel Basınç) kutusuna dönüşür.
3. **Adım 2 (Derivative/Momentum):** Bir önceki durumla () karşılaştırılır ve  (Momentum/İvme) hesaplanır. *Buraya bir hız göstergesi ikonu konabilir.*
4. **Adım 3 (Memory/Scarring):** Momentum kritik eşiği aştıysa "Skar Havuzu"na ekleme yapılır, aşmadıysa "Decay" (Entropi) uygulanır.
5. **Çıkış (Resistance Calc):** Tüm bu veriler  formülüne girer.
6. **Karar Noktası (The Gate):** Çıkan  değeri, gelen isteğin  (Voltaj) değeri ile bir karşılaştırıcıda (Comparator) buluşur. Sonuç: FLOW veya DROP.

**ASCII Taslak:**

```
      [ Telemetry Stream ] ---> ( Vector Pressure P(t) )
                                       |
                                       v
[ Priority V(req) ] ----> [ COMPARATOR (Gate) ] <---- ( Calculate R_total )
         |                     ^   | FLOW/DROP                ^
         v                     |______________________________|
[ THE DECISION POINT ]                                        |
                                                      ( Update Scar/Decay S(t) )
                                                              ^
                                                              |
                                                      ( Calculate Momentum M(t) )

```

---

### Figure 3: Temporal Resistance Behavior (Zaman Çizelgesi ve Momentum Etkisi)

**Amaç:** Sistemin proaktifliğini (Momentum) ve hafızasını (Skar) bir kriz senaryosu üzerinden zaman çizelgesinde göstermek.

**Görsel Açıklama:**
Bir X-Y grafiği. X ekseni Zaman (), Y ekseni Değer (Hata Oranı ve Direnç).

* **Kırmızı Çizgi (Hata Oranı - Pressure):**  anında yavaşça artmaya başlıyor, 'de zirve yapıyor, 'te aniden düşüyor (sorun çözüldü).
* **Mavi Çizgi (CDO Direnci - Resistance):**
* **Proaktiflik (Momentum):** 'de hata oranı henüz düşükken, artış *hızı* yüksek olduğu için Mavi çizgi, Kırmızı çizgiden **daha erken ve daha dik** yükselmeye başlıyor. (Frenleme).
* **Hafıza (Scarring):** 'te hata oranı sıfıra düşse bile, Mavi çizgi hemen başlangıç seviyesine inmiyor. Yüksek bir platoda kalıyor ve yavaşça sönümleniyor (Decay).

* **Vurgu Alanı:** Kırmızı çizginin zirve yaptığı yerin öncesine "Momentum Driven Damping", sonrasına "Scar Tissue Decay" etiketleri eklenir.

**ASCII Taslak (Grafik):**

```
Y-Axis (Value)
^
|           /---\ (Pressure Peak)
|          /     \
| Resis.  /|      \
| (Blue) / |       \____ (Scar Decay - Slow Recovery)
|       /  |
|      /   | Pressure (Red)
|     /    |
|____/_____|____________________> X-Axis (Time)
   t1      t2       t3
(Start)  (Peak)   (Fixed)

* Note: Resistance rises BEFORE pressure peaks due to Momentum.
* Note: Resistance stays high AFTER pressure drops due to Scarring.

```
