# Cum setezi Cloudinary pentru Club Finder

Aplicația urcă pozele direct din browser. Are nevoie de două valori publice: **cloud name**-ul contului și numele unui upload preset **unsigned**. Cheia secretă de API nu intră în proiect.

Presetul din `.env` se numește `club_finder`. Numele din consolă trebuie să fie identic.

## 1. Cont gratuit

1. Deschide [cloudinary.com](https://cloudinary.com/) și alege înregistrarea gratuită. Poți intra cu Google, GitHub sau email. Nu cere card.
2. Confirmă emailul dacă ți-l cere.
3. Ajungi în [consolă](https://console.cloudinary.com/). Planul gratuit are 25 de credite pe 30 de zile. Un credit înseamnă 1 GB stocare, sau 1 GB bandă pentru imagini, sau 1000 de transformări. Pentru coperți de club ajunge.

## 2. Cloud name

1. În consolă, deschide **Dashboard**.
2. Sus, la **Product Environment**, copiază **Cloud name**. Arată cam ca `dxxxxxxxx` sau ca un nume scurt pe care l-ai ales tu.
3. Dacă vrei un nume lizibil (de exemplu `club-finder`), fă-o acum, înainte să salvezi poze: **Settings → Product Environments →** meniul de pe rândul mediului **→ Edit**. După ce URL-urile de poze sunt deja în Firestore, schimbarea numelui le strică.

Cloud name-ul apare în fiecare URL de poză. Poate sta în codul din browser. **API Secret** nu. Nu îl copia în `.env` și nu îl pune în chat.

## 3. Upload preset

Aplicația trimite `upload_preset=club_finder` și un folder (`venues/{id}` sau `events/{id}`). Restul regulilor stau în preset, nu în cod.

1. **Settings** (rotița) **→ Upload**.
2. Tab-ul **Upload presets**.
3. **Add upload preset**.

### General

| Câmp | Valoare |
| --- | --- |
| Upload preset name | `club_finder` |
| Signing mode | **Unsigned** |
| Asset folder | gol |
| Use filename as public ID | oprit |
| Disallow public ID | pornit |

Folderul rămâne gol. Dacă îl completezi aici, consola câștigă în fața aplicației și toate pozele aterizează în același loc, nu pe clubul sau evenimentul editat.

**Unsigned** e obligatoriu. Un preset semnat cere o semnătură făcută pe un server, iar aplicația nu are server.

### Transform

În tab-ul **Transform**, la **Incoming transformation**, pune:

```
c_limit,w_2000
```

Asta taie lățimea la 2000 px înainte să stocheze fișierul. Pozele mai mici rămân la dimensiunea lor.

Nu pune `f_auto` și nu pune `f_jpg`. Formatul potrivit (WebP sau AVIF) se alege la afișare, în browser. Dacă îl fixezi la upload, livrarea optimizată nu mai are din ce alege.

Lasă **Eager transformations** goale.

### Optimize and deliver

În tab-ul **Optimize and deliver**:

| Câmp | Valoare |
| --- | --- |
| Allowed formats | `jpg,png,webp,gif,heic,heif` |
| Format | gol |

`heic` și `heif` sunt pozele de pe iPhone. **Format** gol înseamnă că originalul rămâne original; lista de carduri și coperta cer apoi o variantă redimensionată.

Salvează presetul. În listă, signing mode trebuie să apară ca unsigned.

Aplicația refuză singură fișierele peste 8 MB și pe cele care nu sunt imagini. Presetul Cloudinary nu are limită de mărime.

## 4. Leagă contul de aplicație

În `.env`, pe mașina ta (fișierul nu se comite):

```
VITE_CLOUDINARY_CLOUD_NAME=numele-copiat-de-pe-dashboard
VITE_CLOUDINARY_UPLOAD_PRESET=club_finder
```

Oprește serverul de dezvoltare și pornește-l din nou. Vite citește `.env` doar la pornire.

```
npm run dev
```

## 5. Verifică

1. În aplicație: **Profile →** un club **→** încarcă o poză.
2. În consolă: **Media Library**. Poza stă într-un folder `venues/…` sau `events/…`, iar lățimea e cel mult 2000 px.
3. În pagină, coperta și thumbnail-ul sunt aceeași poză, la lățimi diferite. URL-ul din `<img>` conține `c_limit,w_1600,f_auto,q_auto` pe copertă și `w_240` pe thumbnail.

**Remove** scoate URL-ul din Firestore. Fișierul rămâne în Media Library. Ștergerea de acolo se face din consolă, manual, până există conturi și un secret de API pe un server.

## Dacă upload-ul eșuează

Mesajul apare sub formular.

| Mesaj | Ce înseamnă |
| --- | --- |
| `Image uploads need VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.` | Una din variabile e goală, sau serverul n-a fost repornit după `.env`. |
| `Choose an image file.` | Fișierul nu e recunoscut ca imagine. Extensiile acceptate: jpg, png, webp, gif, heic, heif. |
| `Images must be 8 MB or smaller.` | Taie poza înainte de upload. Presetul nu face asta. |
| `Upload preset not found` | Numele din consolă nu e exact `club_finder`, sau presetul e pe alt product environment decât cloud name-ul din `.env`. |
| `Invalid file type` sau un mesaj despre format | **Allowed formats** nu include extensia fișierului. |
| Upload-ul pare reușit, dar poza nu e în `venues/` sau `events/` | Ai completat **Asset folder** în preset. Golește-l și salvează. |

Pozele vechi, cele de la Google Places și linkurile lipite de mână rămân afișate. Doar upload-ul nou trece prin Cloudinary.
