# Futsal Stats App – Product Specification v2

## 1. Tavoite

Rakennetaan kevyt, nopea ja tabletilla käytettävä futsalin ottelu- ja kausitilastosovellus.

Sovellus toimii ensisijaisesti **offline-tilassa**, eikä MVP-versio tarvitse:

- backendia
- käyttäjätunnuksia
- pilvitietokantaa
- Azurea
- omaa palvelinta
- API-yhteyksiä

Sovellus voidaan julkaista staattisena PWA-sovelluksena esimerkiksi Cloudflare Pagesiin tai GitHub Pagesiin. Otteludata tallennetaan laitteen omaan IndexedDB-tietokantaan.

---

# 2. Sovelluksen tärkeimmät käyttötapaukset

Käyttäjä voi:

1. luoda joukkueen
2. lisätä pelaajat
3. luoda kauden
4. nähdä kaikki kauden ottelut yhdessä näkymässä
5. lisätä helposti uuden ottelun
6. avata tulevan ottelun ja määrittää kokoonpanon
7. tilastoida ottelua tabletilla live-tilassa
8. kirjata oman maalin
9. kirjata vastustajan maalin
10. kirjata maalintekijän
11. kirjata syöttäjän
12. kirjata maalin peliajan käsin
13. hallita kentällä olevia pelaajia ja vaihtoja
14. saada plus–miinus automaattisesti
15. perua viimeisimmän virheellisen tapahtuman
16. muokata mitä tahansa tapahtumaa myös jälkikäteen
17. tarkistaa ottelun tilastot pelin jälkeen
18. nähdä pelaajakohtaiset ottelutilastot
19. nähdä koko kauden pelaajatilastot
20. viedä ottelun CSV- ja JSON-tiedostona
21. palauttaa tiedot JSON-varmuuskopiosta myöhemmin

---

# 3. Päänavigaatio

Sovelluksen päänavigaatio:

```text
OTTELUT | PELAAJAT | KAUSI
```

## OTTELUT

Sovelluksen oletus- ja tärkein päänäkymä.

## PELAAJAT

Joukkueen pelaajat sekä yksittäisen pelaajan kausitilastot.

## KAUSI

Koko kauden yhteenveto ja pelaajien vertailu.

Asetukset voidaan sijoittaa erillisen rataskuvakkeen taakse.

---

# 4. Ottelut-näkymä

Ottelut-näkymässä näytetään kaikki valitun kauden pelit.

Esimerkki:

```text
KAUSI 2026–27                         [+ UUSI PELI]

12 ottelua
8 voittoa • 1 tasapeli • 3 tappiota


19.9.2026
vs FC Team A
TULEVA
[ AVAA PELI ]


12.9.2026
vs FC Team B
4–3
PÄÄTTYNYT
[ KATSO TILASTOT ]


5.9.2026
vs FC Team C
2–2
PÄÄTTYNYT
[ KATSO TILASTOT ]
```

Ottelulla on tila:

```text
DRAFT
READY
LIVE
FINISHED
```

### DRAFT
Ottelu on luotu, mutta kokoonpanoa ei ole vielä määritetty.

### READY
Kokoonpano ja aloitusviisikko on määritetty.

### LIVE
Ottelun tilastointi on käynnissä.

### FINISHED
Ottelu on päättynyt, mutta sitä voi edelleen tarkastella ja muokata.

---

# 5. Uuden ottelun lisääminen

Painike:

```text
+ UUSI PELI
```

Avaa yksinkertaisen lomakkeen:

```text
Vastustaja
[________________]

Päivämäärä
[19.09.2026]

Koti / vieras
[ KOTI ] [ VIERAS ]

[ LISÄÄ OTTELU ]
```

Ottelun luonnin ei tarvitse pakottaa käyttäjää heti määrittämään kokoonpanoa.

---

# 6. Ottelun avaaminen

Tulevan ottelun näkymä:

```text
FC Example
vs FC Team A
19.9.2026

Kokoonpano
12 / 14 valittu

[ MUOKKAA KOKOONPANOA ]

Aloitusviisikko
5 / 5 valittu

[ MUOKKAA ALOITUSVIISIKKOA ]

[ ALOITA TILASTOINTI ]
```

---

# 7. Live-ottelun pääperiaate

Live-näkymässä tavoitteena on:

> mahdollisimman vähän painalluksia ja mahdollisimman vähän aikaa katse pois pelistä.

Ottelun aikana ei tarvitse kirjoittaa muuta kuin tarvittaessa maalin peliaika.

---

# 8. Pelikello

Sovelluksessa ei ole pakollista automaattisesti juoksevaa ottelukelloa.

Futsalissa virallinen pelikello pysähtyy, joten sovelluksen oma jatkuva kello ei välttämättä vastaisi oikeaa peliaikaa.

Siksi maalin yhteydessä käyttäjä syöttää **virallisen pelikellon ajan käsin**.

Esimerkiksi:

```text
OMA MAALI

Peliaika
[ 07 : 34 ]

Maalintekijä
#9 Sofia

Syöttäjä
#7 Emma
```

Peliaika tallennetaan sekunteina:

```ts
matchTimeSeconds
```

Esimerkiksi:

```text
07:34
=
454 sekuntia
```

Ottelun jakso tallennetaan erikseen:

```text
1
tai
2
```

Näin kaksi saman peliajan tapahtumaa eri jaksoilla ovat yksiselitteisiä.

---

# 9. Live-näkymä

Esimerkki tabletin vaakasuunnassa:

```text
┌─────────────────────────────────────────────────────────┐
│ FC EXAMPLE          2 – 1          OPPONENT       ↶ PERU │
├───────────────────────────┬─────────────────────────────┤
│ KENTÄLLÄ                  │ PENKKI                      │
│                           │                             │
│ #1 Anna       +/- +1      │ #3 Aino                    │
│ #4 Laura      +/-  0      │ #5 Ella                    │
│ #7 Emma       +/- +1      │ #8 Sara                    │
│ #9 Sofia      +/- +2      │ #10 Iida                   │
│ #14 Veera     +/- -1      │ #12 Noora                  │
├───────────────────────────┴─────────────────────────────┤
│                                                         │
│      [ ⚽ OMA MAALI ]   [ 🥅 VASTUSTAJAN MAALI ]        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Viimeisin: 12:18 Vastustajan maali                      │
└─────────────────────────────────────────────────────────┘
```

---

# 10. Kentällä olevat pelaajat

Sovellus ylläpitää tietoa siitä, ketkä pelaajat ovat kentällä.

Normaalitilanteessa:

```text
5 pelaajaa
```

Sovelluksen ei kuitenkaan pidä tehdä viiden pelaajan sääntöä täysin ehdottomaksi, koska futsalissa voi tulla:

- ulosajo
- 4v5
- 5v4
- lentävä maalivahti
- poikkeava tilanne

MVP voi näyttää varoituksen, jos kentällä on alle tai yli viisi, mutta ei estää käyttäjää jatkamasta.

---

# 11. Vaihdot

Nopea vaihtologiikka:

1. paina kentällä olevaa pelaajaa
2. paina penkillä olevaa pelaajaa
3. vaihto kirjataan

Esimerkiksi:

```text
#9 Sofia -> #10 Iida
```

Vaihtotapahtuma tallennetaan tapahtumalokiin.

---

# 12. Oman maalin kirjaus

Oman maalin yhteydessä pakollista on vain:

- peliaika
- että oma joukkue teki maalin
- ketkä oman joukkueen pelaajista olivat kentällä

Maalintekijä ja syöttäjä ovat **vapaaehtoisia lisätietoja**.

Minimiflow:

```text
OMA MAALI
   ↓
PELIAIKA
   ↓
TALLENNA
```

Sovellus käyttää automaattisesti nykyistä oman joukkueen kentällistä.

Haluttaessa käyttäjä voi ennen tallennusta tai myöhemmin ottelun tarkistusnäkymässä lisätä:

```text
Maalintekijä
[ valinnainen ]

Syöttäjä
[ valinnainen ]
```

Kun tapahtuma tallennetaan:

- oma tulos +1
- kaikille maalin hetkellä kentällä olleille oman joukkueen pelaajille +1
- jos maalintekijä on täytetty, hänelle maali +1
- jos syöttäjä on täytetty, hänelle syöttö +1

Maalintekijää tai syöttäjää ei tarvitse täyttää, jotta maali voidaan tallentaa.

---

# 13. Vastustajan maali

Flow:

```text
VASTUSTAJAN MAALI
   ↓
PELIAIKA
   ↓
TALLENNA
```

Tallennuksessa:

- vastustajan tulos +1
- kaikille maalin hetkellä kentällä olleille **oman joukkueen** pelaajille −1

Vastustajan joukkueesta EI kirjata pelaajakohtaista dataa.

Vastustajan maalissa ei ole kenttiä:

- maalintekijälle
- syöttäjälle
- vastustajan kentällä olleille pelaajille
- vastustajan kokoonpanolle

Sovellus seuraa pelaajatasolla vain oman joukkueen pelaajia.

---

# 14. Plus–miinus

Pelaajan ottelukohtainen:

```text
plusMinus = plus - minus
```

Missä:

```text
plus
=
oman joukkueen maalit pelaajan ollessa kentällä

minus
=
vastustajan maalit pelaajan ollessa kentällä
```

---

# 15. Tapahtumaloki

Kaikki olennainen otteludata tallennetaan tapahtumina.

Esimerkiksi:

```text
03:11  OMA MAALI
       #9 Sofia
       syöttö #7 Emma
       lineup 1,4,7,9,14

05:34  VAIHTO
       #4 Laura -> #10 Iida

07:22  VASTUSTAJAN MAALI
       lineup 1,7,9,10,14
```

Tapahtumaloki on otteludatan varsinainen lähde.

---

# 16. Peru viimeisin

Live-näkymässä aina helposti saatavilla:

```text
↶ PERU
```

Undo poistaa viimeisimmän tapahtuman ja laskee ottelutilan uudelleen tapahtumalokin perusteella.

Älä muuta laskureita käsin takaisin.

---

# 17. Vanhan tapahtuman korjaaminen

Käyttäjä voi avata tapahtumalokin ja painaa mitä tahansa tapahtumaa.

Esimerkiksi:

```text
18:22 OMA MAALI

Peliaika
[18:22]

Maalintekijä
[#9 Sofia]

Syöttäjä
[#7 Emma]

Kentällä
[x] #1 Anna
[x] #4 Laura
[x] #7 Emma
[x] #9 Sofia
[x] #14 Veera

[ POISTA TAPAHTUMA ]
[ TALLENNA MUUTOKSET ]
```

Kun tapahtumaa muokataan, kaikki ottelu- ja kausitilastot lasketaan uudelleen automaattisesti.

---

# 18. Ottelun lopetus

Painike:

```text
LOPETA OTTELU
```

Lopetuksen jälkeen ottelu saa tilan:

```text
FINISHED
```

Tämä ei tarkoita, että ottelu olisi lukittu.

Ottelua voi edelleen:

- tarkastella
- korjata
- muokata
- viedä tiedostoksi

---

# 19. Ottelun jälkeinen tarkistus

Ottelun jälkeen:

```text
FC Example 4–3 FC Team B

[ YHTEENVETO ]
[ PELAAJAT ]
[ TAPAHTUMAT ]
```

---

# 20. Ottelun pelaajatilastot

Esimerkiksi:

| Pelaaja | M | S | + | − | +/- |
|---|---:|---:|---:|---:|---:|
| #9 Sofia | 2 | 1 | 4 | 2 | +2 |
| #7 Emma | 0 | 2 | 3 | 2 | +1 |
| #4 Laura | 1 | 0 | 2 | 1 | +1 |
| #14 Veera | 1 | 0 | 2 | 3 | -1 |

`M` ja `S` sisältävät vain ne maalit ja syötöt, jotka käyttäjä on vapaaehtoisesti kirjannut. Plus–miinus toimii riippumatta siitä, onko maalintekijää tai syöttäjää täytetty.

---

# 21. Pelaajan ottelunäkymä

Pelaajaa painamalla:

```text
#9 SOFIA

Maalit      2
Syötöt      1
Plus        4
Miinus      2
+/-        +2

TAPAHTUMAT

03:11 ⚽ maali
08:42 + oma maali kentällä
12:18 - vastustajan maali kentällä
14:20 ⚽ maali
```

---

# 22. Kausitilastot

Kausitilastot lasketaan kaikkien kauden otteluiden tapahtumista.

Esimerkiksi:

| Pelaaja | O | M | S | P | + | − | +/- |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sofia | 12 | 9 | 6 | 15 | 28 | 20 | +8 |
| Emma | 11 | 4 | 8 | 12 | 25 | 19 | +6 |
| Laura | 10 | 5 | 2 | 7 | 21 | 22 | -1 |

Missä:

```text
O = ottelut
M = maalit
S = syötöt
P = tehopisteet
+ = plus
− = miinus
+/- = plus–miinus
```

---

# 23. Pelaajan kausinäkymä

Esimerkiksi:

```text
#9 SOFIA

KAUSI 2026–27

Ottelut       12
Maalit          9
Syötöt          6
Tehopisteet    15
Plus           28
Miinus         20
+/-            +8

OTTELUT

12.9. Team B    2 M | 1 S | +2
5.9. Team C     0 M | 2 S | +1
29.8. Team D    1 M | 0 S | -1
```

Otteluriviä painamalla pääsee kyseisen ottelun näkymään.

---

# 24. Kausitilastoja ei tallenneta erillisinä summalukuina

Älä käytä kausitilastoa lähdedatana.

Sen sijaan:

```text
ottelut
↓
tapahtumalokit
↓
ottelukohtaiset tilastot
↓
kausitilastot
```

Jos vanhaa ottelua korjataan, kausitilastot päivittyvät automaattisesti.

---

# 25. Offline-first

Ottelun käyttö ei saa riippua internetistä.

Tallennus:

```text
IndexedDB
```

PWA:n sovelluskoodi tallennetaan Service Worker -välimuistiin.

Sovellus toimii:

```text
internet päällä
tai
internet pois päältä
```

---

# 26. Hosting

Hosting sisältää vain sovelluksen staattiset tiedostot:

```text
HTML
CSS
JavaScript
PWA manifest
ikonit
```

Esimerkiksi:

```text
Cloudflare Pages
tai
GitHub Pages
```

Otteludataa ei lähetetä hostauspalveluun.

---

# 27. Varmuuskopiointi

Koska data on vain laitteen IndexedDB:ssä, varmuuskopiointi on tärkeää.

Tarjoa:

```text
VIE JSON-VARMUUSKOPIO
```

JSON sisältää:

- kaudet
- joukkueen
- pelaajat
- ottelut
- kokoonpanot
- tapahtumat

Lisäksi:

```text
TUO JSON-VARMUUSKOPIO
```

---

# 28. CSV-vienti

Ottelun pelaajatilastot:

```csv
number,name,goals,assists,plus,minus,plus_minus
9,Sofia,2,1,4,2,2
```

Tapahtumat:

```csv
period,time,type,scorer,assist,lineup
1,07:34,OWN_GOAL,9,7,"1|4|7|9|14"
```

---

# 29. Taso / Palloliitto

MVP EI käytä Palloliiton tai Tason rajapintaa.

Tämä on myöhemmän vaiheen ominaisuus.

Arkkitehtuurissa voidaan kuitenkin varautua siihen, että tulevaisuudessa ottelutapahtuma voi sisältää:

```ts
source: "MANUAL" | "PALLOLIITTO" | "RECONCILED"
```

Mahdollinen tuleva toiminto:

```text
HAE TULOSPALVELUSTA
```

voisi verrata:

- maaliaikaa
- maalintekijää
- syöttäjää

oman sovelluksen dataan.

Automaattista ylikirjoitusta ei pidä tehdä ilman käyttäjän hyväksyntää.

---

# 30. MVP Definition of Done

MVP on valmis, kun:

1. sovellus toimii tabletilla
2. sovellus toimii offline
3. ottelulista toimii
4. uusi ottelu voidaan lisätä helposti
5. ottelun voi avata listalta
6. kokoonpanon voi valita
7. aloitusviisikon voi valita
8. kentällä olevia pelaajia voi vaihtaa
9. oman maalin voi kirjata
10. vastustajan maalin voi kirjata
11. maalin peliajan voi syöttää käsin
12. maalintekijän voi valita
13. syöttäjän voi valita
14. plus–miinus lasketaan automaattisesti
15. viimeisen tapahtuman voi perua
16. vanhaa tapahtumaa voi muokata
17. ottelun voi päättää
18. ottelun tilastot voi tarkistaa
19. koko kauden tilastot näkyvät pelaajittain
20. vanhan ottelun korjaus päivittää kausitilastot
21. CSV-vienti toimii
22. JSON-varmuuskopio toimii
23. sovellus palautuu refreshin jälkeen ilman datan menetystä


---

# 31. Pelaajat ja pelinumerot

Pelinumero on pelaajan **pakollinen tieto**.

Nimi on valinnainen.

Pelaajan lisääminen:

```text
Pelinumero *
[ 9 ]

Nimi
[ Sofia ]

[ LISÄÄ PELAAJA ]
```

Sovelluksen pitää toimia myös täysin ilman pelaajien nimiä:

```text
#1
#4
#7
#9
#14
```

Jos nimi on annettu, pelaaja näytetään muodossa:

```text
#9 Sofia
```

Jos nimeä ei ole annettu:

```text
#9
```

Pelinumero näytetään aina vähintään seuraavissa paikoissa:

- pelaajalista
- kokoonpanon valinta
- aloitusviisikko
- kentällä olevat pelaajat
- penkki
- maalintekijän valinta
- syöttäjän valinta
- tapahtumaloki
- ottelutilastot
- kausitilastot
- CSV-vienti
- JSON-vienti

Saman aktiivisen joukkueen sisällä pelinumeron tulee lähtökohtaisesti olla yksilöllinen.

Koska pelaajan pelinumero voi muuttua myöhemmin, ottelukokoonpanoon tallennetaan kyseisessä ottelussa käytetyn pelinumeron snapshot. Näin vanhojen otteluiden raportit eivät muutu jälkikäteen, vaikka pelaajan numero vaihtuisi.


---

# 32. Oletuspelinumero ja ottelukohtainen pelinumero

Jokaisella pelaajalla on joukkueen pelaajalistassa **oletuspelinumero**.

Esimerkiksi:

```text
PELAAJAT

#1 Anna
#4 Laura
#7 Emma
#9 Sofia
#14 Veera
```

Kun uusi ottelu luodaan ja pelaaja valitaan ottelun kokoonpanoon, sovellus kopioi automaattisesti pelaajan oletusnumeron ottelukohtaiseksi numeroksi.

Esimerkiksi:

```text
Player.number = 9
```

uuden ottelun kokoonpanossa:

```text
MatchPlayer.playerNumber = 9
```

Normaalissa tilanteessa käyttäjän ei tarvitse muuttaa numeroita koskaan ottelukohtaisesti.

## 32.1 Ottelukohtaisen numeron muuttaminen

Kokoonpanonäkymässä pelinumero voidaan kuitenkin vaihtaa vain kyseistä ottelua varten.

Esimerkki:

```text
KOKOONPANO – vs FC Team A

✓ [ 1 ] Anna
✓ [ 4 ] Laura
✓ [ 7 ] Emma
✓ [17 ] Sofia
✓ [14 ] Veera
```

Sofian oletusnumero joukkueessa voi olla:

```text
#9
```

mutta kyseisessä ottelussa:

```text
#17
```

Tämä EI muuta pelaajan oletusnumeroa joukkueen pelaajalistassa.

Seuraavaa ottelua luotaessa oletukseksi tulee taas:

```text
#9
```

ellei käyttäjä muuta sitä uudestaan juuri kyseiseen otteluun.

## 32.2 Ottelukohtainen numero näkyy kaikkialla kyseisessä pelissä

Kun ottelukohtainen numero on muutettu, käytä sitä kaikissa kyseisen ottelun näkymissä:

- kokoonpano
- aloitusviisikko
- kenttä
- penkki
- maalintekijän valinta
- syöttäjän valinta
- tapahtumaloki
- ottelun pelaajatilastot
- ottelun CSV-vienti
- ottelun JSON-vienti

Esimerkiksi:

```text
#17 Sofia
```

ei:

```text
#9 Sofia
```

kyseisessä ottelussa.

## 32.3 Historialliset ottelut

Ottelukohtainen numero tallennetaan snapshotina `MatchPlayer`-tietoon.

Näin:

```text
5.9.2026   Sofia #9
12.9.2026  Sofia #17
19.9.2026  Sofia #9
```

säilyvät myöhemmin juuri noin, vaikka pelaajan oletusnumero muuttuisi.

## 32.4 Numeron muokkaamisen UX

Suositus: numerokenttä näkyy suoraan kokoonpanolistassa.

```text
✓ [ 9 ] Sofia
```

Kentän voi napauttaa ja vaihtaa esimerkiksi:

```text
✓ [17 ] Sofia
```

Tämän tulee olla nopea numeerinen kenttä, ei erillinen monivaiheinen editori.

Jos nimi puuttuu:

```text
✓ [17 ]
```

on täysin validi pelaaja.

## 32.5 Validointi ottelussa

Ottelukohtaiset pelinumerot eivät saa normaalisti olla päällekkäisiä saman ottelun kokoonpanossa.

Jos käyttäjä syöttää saman numeron kahdelle valitulle pelaajalle:

```text
#9 Sofia
#9 Emma
```

näytä selkeä virhe:

```text
Pelinumero 9 on jo käytössä tässä ottelussa.
```

Älä aloita ottelua ennen kuin päällekkäiset numerot on korjattu.



---

# 33. Maalit & +/- -näkymä

Yksittäisellä ottelulla on oma näkymä:

```text
YHTEENVETO | PELAAJAT | MAALIT & +/- | TAPAHTUMAT
```

`MAALIT & +/-` näyttää jokaisen maalin ja siitä syntyneet oman joukkueen plus- tai miinusmerkinnät.

Esimerkki:

| Jakso | Aika | Tapahtuma | Lisätieto | Oman joukkueen pelaajat |
|---:|---:|---|---|---|
| 1 | 07:34 | Oma maali | #9 Sofia, syöttö #7 Emma | + #1 #4 #7 #9 #14 |
| 1 | 12:18 | Vastustajan maali | — | − #1 #4 #7 #9 #14 |
| 2 | 06:02 | Oma maali | ei tekijää kirjattu | + #1 #7 #9 #10 #14 |
| 2 | 18:41 | Vastustajan maali | — | − #1 #5 #7 #10 #14 |

Maalintekijä ja syöttäjä näytetään vain silloin, kun ne on kirjattu.

Maaliriviä painamalla käyttäjä voi muokata:

- jaksoa
- peliaikaa
- oman joukkueen kentällä olleita pelaajia
- oman joukkueen maalintekijää, jos kyseessä on oma maali
- oman joukkueen syöttäjää, jos kyseessä on oma maali

Vastustajan maalissa ei voi lisätä vastustajan maalintekijää, syöttäjää tai kentällistä.

---

# 34. Oman joukkueen data only

Sovellus tallentaa pelaajatasolla vain oman joukkueen dataa.

Tallennetaan oman joukkueen:

- pelaajat
- pelinumerot
- ottelukohtaiset pelinumerot
- kokoonpanot
- kentällä olleet pelaajat
- plus
- miinus
- plus–miinus
- vapaaehtoisesti kirjatut maalit
- vapaaehtoisesti kirjatut syötöt

Vastustajasta tallennetaan vain ottelutason tiedot:

```text
vastustajan nimi
vastustajan maalit
vastustajan maaliaika
```

Vastustajan pelaajista ei tallenneta:

- nimiä
- numeroita
- maalintekijöitä
- syöttäjiä
- kentällisiä
- kokoonpanoja

---

# 35. Maalit ja syötöt ovat vapaaehtoisia

Plus–miinus-tilastoinnin pitää toimia täysin ilman maalintekijä- ja syöttäjätietoja.

Validi oman joukkueen maali:

```text
07:34 OMA MAALI
+ #1 #4 #7 #9 #14
```

Myös tämä on validi:

```text
07:34 OMA MAALI
Maalintekijä #9 Sofia
Syöttäjä #7 Emma
+ #1 #4 #7 #9 #14
```

Käyttäjän ei tarvitse kirjata tehopisteitä live-tilanteessa. Ne voidaan haluttaessa lisätä myöhemmin tapahtuman muokkauksessa.
