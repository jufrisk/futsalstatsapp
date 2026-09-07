# Futsal Stats App – UX & Functional Rules v2

## 1. Pääperiaate

Live-käyttö:

> katso peliä, älä tablettia.

Jälkikäyttö:

> kaikki pitää pystyä tarkistamaan ja korjaamaan helposti.

---

# 2. Päänavigaatio

```text
OTTELUT | PELAAJAT | KAUSI
```

Ottelut on oletusnäkymä.

---

# 3. Ottelut päänäkymänä

Yläosa:

```text
Kausi 2026–27

[ + UUSI PELI ]
```

Alla kaikki ottelut.

Ottelukortti näyttää:

- päivämäärä
- vastustaja
- koti/vieras
- status
- tulos, jos pelattu

---

# 4. Ottelukortin toiminta

## Tuleva

```text
19.9.2026
FC Team A
Tuleva

[ AVAA ]
```

Avaa valmistelun.

## Live

```text
12.9.2026
FC Team B
LIVE 2–1

[ JATKA TILASTOINTIA ]
```

## Päättynyt

```text
5.9.2026
FC Team C
4–3

[ KATSO TILASTOT ]
```

---

# 5. Uusi peli

Pidä lomake lyhyenä.

Pakolliset:

```text
vastustaja
päivämäärä
koti/vieras
```

Ei kokoonpanoa samassa modaalissa.

---

# 6. Ottelun valmistelu

```text
KOKOONPANO
12 / 14

ALOITUSVIISIKKO
5 / 5

[ ALOITA TILASTOINTI ]
```

---

# 7. Live-layout tablet landscape

```text
SCORE                         UNDO

KENTÄLLÄ           PENKKI

player             player
player             player
player             player
player             player
player             player

OMA MAALI       VASTUSTAJAN MAALI

VIIMEISIMMÄT TAPAHTUMAT
```

---

# 8. Ei automaattista pelikelloa

Sovellus ei yritä pitää virallista pelikelloa synkronoituna.

Maalitapahtumassa syötetään maalin aika.

---

# 9. Peliajan syöttö

Maaliajan UI pitää olla erittäin nopea.

Suositeltu ratkaisu tabletilla:

```text
Peliaika

[ 07 ] : [ 34 ]
```

Kentät:

- minuutit
- sekunnit

Numeronäppäimistö.

Vaihtoehtoisesti custom numpad:

```text
1 2 3
4 5 6
7 8 9
  0
```

Älä vaadi käyttäjää kirjoittamaan kaksoispistettä.

---

# 10. Jakso

Live-näkymässä käyttäjä asettaa nykyisen jakson:

```text
1. JAKSO
2. JAKSO
```

Maalitapahtuma ottaa oletuksena nykyisen jakson.

Eventin muokkauksessa jakso voidaan korjata.

---

# 11. Own goal flow

Pakollinen nopea flow:

```text
[ OMA MAALI ]
```

↓

```text
PELIAIKA 07:34
```

↓

```text
Kentällä:
#1 #4 #7 #9 #14
```

↓

```text
[ TALLENNA ]
```

Lisäksi tarjotaan vapaaehtoinen toiminto:

```text
[ + MAALINTEKIJÄ / SYÖTTÄJÄ ]
```

Jos käyttäjä avaa sen:

```text
Maalintekijä
[ valinnainen ]

Syöttäjä
[ valinnainen ]
```

Käyttäjä voi jättää molemmat tyhjiksi.

Maalintekijä ja syöttäjä voidaan lisätä myös myöhemmin tapahtuman muokkauksessa.

---

# 12. Opponent goal flow

```text
[ VASTUSTAJAN MAALI ]
```

↓

```text
PELIAIKA 12:18
```

↓

```text
Oman joukkueen kentällä:
#1 #4 #7 #9 #14
```

↓

```text
[ TALLENNA ]
```

Vastustajan maalissa ei koskaan kysytä:

- maalintekijää
- syöttäjää
- vastustajan kentällä olleita pelaajia

Miinus annetaan automaattisesti oman joukkueen nykyiselle kentälliselle.

---

# 13. Lineup tallennetaan maalin mukana

Käyttäjän ei normaalisti tarvitse valita lineupia maaliflowssa.

Sovellus käyttää automaattisesti nykyistä lineupia.

Näytä kuitenkin esimerkiksi:

```text
Kentällä:
1, 4, 7, 9, 14
```

ennen tallennusta tai tallennuksen jälkeen lyhyesti.

---

# 14. Vaihto

```text
tap kentällä oleva
→ tap penkillä oleva
```

Välitön event.

---

# 15. Undo

Näkyy live-näkymässä koko ajan.

```text
↶ PERU
```

Näytä undo-tapahtuman kuvaus:

```text
Perutaan:
12:18 Vastustajan maali
```

---

# 16. Tapahtumaloki live-näkymässä

Näytä esimerkiksi 3–5 viimeisintä.

```text
12:18 🥅 Vastustajan maali
09:44 ⇄ #4 → #10
07:34 ⚽ #9 Sofia (#7 Emma)
```

Kaikkia voi painaa.

---

# 17. Tapahtuman painaminen

Avaa editorin.

Goal:

```text
OMA MAALI

Jakso
[2]

Peliaika
[18] : [22]

Maalintekijä
[#9 Sofia]

Syöttäjä
[#7 Emma]

Kentällä
[x] #1
[x] #4
[x] #7
[x] #9
[x] #14

[ POISTA ]
[ TALLENNA ]
```

---

# 18. Miksi lineupia pitää voida korjata

Esimerkkivirhe:

Käyttäjä unohti kirjata vaihdon juuri ennen maalia.

Eventissä lukee:

```text
1,4,7,9,14
```

Todellisuudessa:

```text
1,10,7,9,14
```

Korjaamalla maalin lineup:

```text
#4 plus -1
#10 plus +1
```

automaattisesti.

---

# 19. Pelin jälkeen

```text
OTTELU PÄÄTTYNYT

FC Example 4–3 FC Team B

[ YHTEENVETO ]
[ PELAAJAT ]
[ TAPAHTUMAT ]
```

---

# 20. Summary

Näytä:

- lopputulos
- maalit
- maalintekijät
- syöttäjät
- peliajat

---

# 21. Players

Taulukko:

```text
#   Pelaaja   M   S   +   -   +/-
```

Riviä painamalla pelaajan ottelunäkymään.

---

# 22. Events

Täysi kronologinen tapahtumaloki.

Järjestely näyttöä varten:

```text
period
matchTimeSeconds
```

mutta järjestelmän sisäinen event-tila käyttää sequencea.

---

# 23. Eventin muokkaus ottelun jälkeen

Täysin sama editori kuin live-tilassa.

Ei erillistä "avaa ottelu uudelleen liveksi" -toimintoa.

---

# 24. Kauden pelaajatilastot

Pelaajat-näkymä:

```text
#9 Sofia
12 O
9 M
6 S
15 P
+8
```

Pelaajaa painamalla yksityiskohtiin.

---

# 25. Pelaajan kausisivu

```text
#9 SOFIA

12 ottelua
9 maalia
6 syöttöä
15 pistettä

+28
-20
+/- +8

OTTELUT
```

Ottelurivi vie ottelun tilastoihin.

---

# 26. Kausi-näkymä

Esimerkiksi:

```text
KAUSI 2026–27

Ottelut 12
Voitot 8
Tasapelit 1
Tappiot 3

Maalit 47–31
```

Alla pelaajataulukko.

---

# 27. Vienti ottelun jälkeen

```text
[ VIE PELAAJAT CSV ]
[ VIE TAPAHTUMAT CSV ]
[ VIE OTTELU JSON ]
```

---

# 28. Koko sovelluksen backup

Asetuksissa:

```text
[ VARMUUSKOPIOI KAIKKI ]
[ PALAUTA VARMUUSKOPIO ]
```

---

# 29. Offline-viesti

Ei tarvitse näyttää jatkuvasti.

Jos halutaan status:

```text
Offline – kaikki tallentuu laitteelle
```

mutta offline ei ole virhetila.

---

# 30. Touch guidelines

Minimum:

```text
44×44 px
```

Live player cards:

```text
mieluummin 56–72 px korkeus
```

Goal buttons:

```text
mieluummin 64+ px
```

---

# 31. Live-näkymässä vältettävää

Älä käytä:

- pieniä dropdown-valikoita
- hover-toimintoja
- monimutkaisia taulukoita
- kirjoittamista muihin kuin peliaikaan
- vahvistusdialogia jokaisessa eventissä

---

# 32. Muokkausnäkymässä saa olla enemmän tietoa

Pelin jälkeen käyttäjä ei ole kiireessä.

Siellä voidaan näyttää:

- event metadata
- lineup
- timestamp
- scorer
- assist
- delete
- changes

---

# 33. Warning logic

Jos lineupissa ei ole viittä:

```text
Kentällä 4 pelaajaa
```

Varoitus, ei blokkaus.

---

# 34. Error recovery

Kaikki eventit voidaan:

- undo
- edit
- delete

Näin käyttäjän ei tarvitse pelätä väärää painallusta.

---

# 35. UX-success criterion

Live-eventti:

```text
goal
→ aika
→ scorer
→ assist
→ takaisin peliin
```

Tavoite muutama sekunti.

---

# 36. Navigation success criterion

Vanha ottelu:

```text
OTTELUT
→ peli
→ TAPAHTUMAT
→ event
→ muokkaa
→ tallenna
```

Kauden korjaus tapahtuu automaattisesti taustalla.


---

# 37. Pelaajan tunnistaminen käyttöliittymässä

Pelinumero on käyttöliittymän ensisijainen pelaajatunniste.

Pelaajan nimi on valinnainen.

Esimerkki pelaajalistasta:

```text
#1 Anna
#4 Laura
#7
#9 Sofia
#14
```

Tämä on täysin hyväksytty kokoonpano.

Pelinumero näkyy aina myös silloin, kun nimi on tallennettu.

Hyvä:

```text
#9 Sofia
```

Ei käytetä:

```text
Sofia
```

yksin otteluun liittyvissä näkymissä.

Pelaajan lisäyslomake:

```text
PELAAJA

Pelinumero *
[ 9 ]

Nimi
[ valinnainen ]

[ LISÄÄ ]
```

Ottelun tilastotaulukossa voidaan näyttää:

```text
#   Pelaaja   M   S   +   -   +/-
9   Sofia     2   1   4   2   +2
14            1   0   2   3   -1
```

Jos nimeä ei ole, nimisolu jää tyhjäksi. Pelinumero yksin riittää.


---

# 38. Oletusnumero ja ottelukohtainen numero UX:ssa

Pelaajat-näkymä sisältää pelaajan oletusnumeron:

```text
PELAAJAT

#1 Anna
#4 Laura
#7 Emma
#9 Sofia
#14 Veera
```

Uuden ottelun kokoonpanossa nämä kopioidaan automaattisesti:

```text
KOKOONPANO

✓ [ 1 ] Anna
✓ [ 4 ] Laura
✓ [ 7 ] Emma
✓ [ 9 ] Sofia
✓ [14 ] Veera
```

Numerokenttä on suoraan muokattavissa.

Esimerkki:

```text
✓ [17] Sofia
```

Tämä tarkoittaa vain:

> Sofia käyttää tässä ottelussa numeroa 17.

Pelaajat-näkymässä hänen oletusnumeronsa pysyy edelleen numerona 9.

Seuraavaan uuteen otteluun kopioidaan jälleen oletuksena numero 9.

## Match-specific display rule

Kun ottelukohtainen numero on 17:

```text
#17 Sofia
```

näytetään koko kyseisen ottelun ajan.

Älä näytä samassa ottelussa hänen default-numeroaan #9.

## Number-only player

Jos nimeä ei ole:

```text
✓ [17]
```

ja live-näkymässä:

```text
#17
```

riittää.

## Duplicate warning

Jos kahdella valitulla pelaajalla on sama ottelunumero:

```text
Pelinumero 17 on kahdella kokoonpanon pelaajalla.
```

Korosta molemmat rivit ja estä:

```text
ALOITA TILASTOINTI
```

kunnes numerot ovat yksilöllisiä.


---

# 39. Maalit & +/- -välilehti

Ottelun sisällä:

```text
YHTEENVETO | PELAAJAT | MAALIT & +/- | TAPAHTUMAT
```

`MAALIT & +/-` näyttää jokaisen maalin ja oman joukkueen kentällisen.

Esimerkki:

```text
1. jakso 07:34
OMA MAALI
Tekijä: #9 Sofia        [vain jos kirjattu]
Syöttäjä: #7 Emma       [vain jos kirjattu]
+ #1 #4 #7 #9 #14
```

```text
1. jakso 12:18
VASTUSTAJAN MAALI
- #1 #4 #7 #9 #14
```

Vastustajan maalissa ei näytetä vastustajan pelaajatietoja.

Riviä painamalla voi korjata oman joukkueen kentällisen.

Oman maalin tapauksessa voi lisäksi lisätä, muuttaa tai poistaa vapaaehtoisen maalintekijän ja syöttäjän.
