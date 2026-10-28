// Artwork for the intro, drawn in the flat style of the supervisor deck.
//
// sceneSVG(): an SUU office at night. Through the window, a storm over Cedar
// City's red cliffs and a campus skyline; on the desk, a red lamp, a T-bird
// mug, and a SPARC nameplate. 1600×900 units, cropped to fill the screen
// (xMidYMax slice), so everything that matters sits between x≈550 and x≈1050.
//
// birdSVG(): the Thunderbird in flight, facing right, 420×280 units.
// Wings pivot at the shoulders (css/intro.css); talons at TALON.

export const SCENE = {
  boltFrom: { x: 582, y: 84 },
  boltTo: { x: 606, y: 434 },    // behind the middle ridge
  emerge: { x: 615, y: 372 },    // where the bird bursts out of the flash
  drop: { x: 820, y: 528 },      // talons when the book is let go
  land: { x: 820, y: 742 },      // book's center on the desk
  exit: { x: 1820, y: -180 },
  bookWidth: 176,                // book's width on the desk
};

export const BIRD = { w: 420, h: 280, talon: { x: 238, y: 196 } };

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const SERIF = 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif';

export function sceneSVG() {
  return `<svg class="scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#080b17"/><stop offset=".5" stop-color="#181528"/>
      <stop offset=".8" stop-color="#3d1a22"/><stop offset="1" stop-color="#6e2a1e"/>
    </linearGradient>
    <linearGradient id="sc-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9cfc1"/><stop offset="1" stop-color="#c7bba9"/>
    </linearGradient>
    <pattern id="sc-dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="13" cy="13" r="1.2" fill="rgba(22,21,19,.13)"/></pattern>
    <linearGradient id="sc-desk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a4b2c"/><stop offset="1" stop-color="#43251a"/>
    </linearGradient>
    <radialGradient id="sc-lamp" cx="770" cy="700" r="340" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity=".6"/>
      <stop offset=".55" stop-color="#ffb870" stop-opacity=".18"/>
      <stop offset="1" stop-color="#ffb870" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sc-vignette" cx=".5" cy=".45" r=".75">
      <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/>
    </radialGradient>
    <linearGradient id="sc-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".7" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <pattern id="sc-rain" width="40" height="60" patternUnits="userSpaceOnUse">
      <path d="M12 0 L7 22 M32 30 L27 52" stroke="rgba(200,210,235,.3)" stroke-width="1.4" stroke-linecap="round"/>
    </pattern>
    <clipPath id="sc-win"><rect x="490" y="90" width="620" height="450"/></clipPath>
    <filter id="sc-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="near"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="13" result="far"/>
      <feMerge><feMergeNode in="far"/><feMergeNode in="near"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- wall -->
  <rect width="1600" height="900" fill="url(#sc-wall)"/>
  <rect width="1600" height="640" fill="url(#sc-dots)"/>

  <!-- framed T-Birds print -->
  <g transform="translate(200 170)">
    <rect width="190" height="230" fill="#2b2420"/>
    <rect x="12" y="12" width="166" height="206" fill="#f6f3ef"/>
    <rect x="12" y="12" width="166" height="206" fill="url(#sc-dots)"/>
    <path d="M104 46 L70 112 h26 l-10 62 l40 -78 h-26 l12 -50 z" fill="#DB0000"/>
    <text x="95" y="200" text-anchor="middle" font-family="${MONO}" font-size="13" font-weight="700" letter-spacing="3" fill="#161513">T-BIRDS</text>
  </g>

  <!-- SUU pennant -->
  <g transform="translate(1196 150) rotate(-4)">
    <rect x="-7" y="-12" width="8" height="142" rx="3" fill="#3b2a20"/>
    <path d="M0 0 L240 58 L0 116 Z" fill="#DB0000"/>
    <path d="M0 0 L240 58 L0 116 Z" fill="url(#sc-dots)" opacity=".6"/>
    <text x="24" y="72" font-family="${SERIF}" font-weight="700" font-size="40" letter-spacing="2" fill="#fff">SUU</text>
  </g>

  <!-- window -->
  <rect x="470" y="70" width="660" height="490" rx="4" fill="#3a2a20"/>
  <rect x="477" y="77" width="646" height="476" rx="2" fill="none" stroke="#5a4232" stroke-width="2"/>
  <g clip-path="url(#sc-win)">
    <rect x="490" y="90" width="620" height="450" fill="url(#sc-sky)"/>
    <g class="clouds back">
      <path d="M430 168 C500 130 580 150 620 136 C690 112 760 140 820 128 C900 110 980 140 1040 126 C1100 112 1160 130 1200 124 L1200 80 L430 80 Z" fill="#131829"/>
    </g>
    <g class="clouds">
      <path d="M430 210 C480 186 540 200 590 186 C650 168 700 196 760 182 C820 168 880 196 950 178 C1010 164 1080 188 1180 176 L1180 140 C1100 150 1040 128 980 146 C900 166 860 140 800 152 C730 166 690 140 620 158 C560 172 500 160 430 176 Z" fill="#1d2236" opacity=".92"/>
      <path d="M430 262 C520 236 600 254 680 240 C760 226 820 250 900 238 C980 226 1060 248 1180 232 L1180 212 C1080 226 1000 206 920 220 C840 234 780 212 700 224 C620 236 540 218 430 240 Z" fill="#272b40" opacity=".7"/>
    </g>
    <rect class="sky-flash" x="490" y="90" width="620" height="450" fill="#fff" opacity="0"/>
    <g class="sky-fx" filter="url(#sc-glow)"></g>

    <!-- red cliffs -->
    <path d="M490 420 L520 410 L560 414 L585 400 L640 398 L668 386 L730 388 L760 376 L820 380 L850 368 L930 372 L960 360 L1030 366 L1060 356 L1110 360 L1110 540 L490 540 Z" fill="#5a2620"/>
    <path d="M490 452 L540 440 L575 444 L600 428 L660 430 L690 418 L760 424 L800 410 L870 416 L900 404 L960 410 L995 398 L1060 404 L1110 396 L1110 540 L490 540 Z" fill="#84321f" stroke="#b5502e" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M490 488 C540 476 580 482 620 470 L660 472 C700 460 760 466 800 456 L850 460 C900 450 960 456 1000 446 L1050 450 C1080 444 1100 446 1110 444 L1110 540 L490 540 Z" fill="#a3442a"/>
    <path d="M520 500 L516 540 M580 492 L575 540 M650 486 L646 540 M720 476 L716 540 M790 468 L786 540 M860 466 L856 540 M930 460 L926 540 M1000 456 L996 540 M1070 452 L1066 540" stroke="rgba(60,15,10,.35)" stroke-width="2"/>
    <path d="M490 505 C600 498 700 500 800 490 S1000 486 1110 478" stroke="rgba(255,140,90,.2)" stroke-width="2" fill="none"/>

    <!-- campus skyline -->
    <g fill="#16110f">
      <path d="M490 540 L490 512 C510 500 530 506 545 498 C560 506 575 500 590 510 L600 540 Z"/>
      <path d="M640 540 L640 500 L700 500 L700 486 L716 472 L732 486 L732 500 L790 500 L790 540 Z"/>
      <path d="M840 540 L840 508 L880 508 L880 490 L896 490 L896 462 L904 446 L912 462 L912 490 L928 490 L928 508 L980 508 L980 540 Z"/>
      <path d="M1000 540 C1010 516 1030 506 1050 512 C1066 500 1090 506 1100 520 L1110 540 Z"/>
    </g>
    <g fill="#f5c66b" opacity=".85">
      <rect x="652" y="510" width="8" height="10"/><rect x="668" y="510" width="8" height="10"/>
      <rect x="756" y="510" width="8" height="10"/><rect x="772" y="510" width="8" height="10"/>
      <rect x="852" y="516" width="8" height="10"/><rect x="868" y="516" width="8" height="10"/>
      <rect x="900" y="470" width="8" height="12"/>
      <rect x="944" y="516" width="8" height="10"/><rect x="960" y="516" width="8" height="10"/>
    </g>

    <rect class="rain" x="470" y="20" width="680" height="600" fill="url(#sc-rain)"/>
    <rect x="490" y="90" width="620" height="450" fill="url(#sc-glass)"/>
    <rect x="490" y="90" width="620" height="450" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="8"/>
  </g>
  <g fill="#3a2a20">
    <rect x="796" y="90" width="8" height="450"/>
    <rect x="490" y="296" width="620" height="8"/>
  </g>
  <rect x="450" y="552" width="700" height="26" rx="3" fill="#4a3426"/>
  <rect x="450" y="552" width="700" height="4" fill="#6b4d38"/>

  <!-- desk -->
  <rect x="0" y="626" width="1600" height="14" fill="rgba(0,0,0,.18)"/>
  <rect x="0" y="640" width="1600" height="260" fill="url(#sc-desk)"/>
  <path d="M0 640 H1600" stroke="#9a6a45" stroke-width="3"/>
  <g stroke="rgba(0,0,0,.15)" stroke-width="2" fill="none">
    <path d="M0 690 C300 680 600 702 900 690 S1400 680 1600 694"/>
    <path d="M0 752 C260 742 640 766 980 750 S1420 744 1600 758"/>
    <path d="M0 822 C340 812 700 836 1060 818 S1440 812 1600 828"/>
  </g>
  <g stroke="rgba(255,220,180,.07)" stroke-width="2" fill="none">
    <path d="M0 716 C400 706 800 726 1200 712 S1500 708 1600 716"/>
    <path d="M0 790 C300 782 760 800 1100 786 S1460 780 1600 790"/>
  </g>

  <!-- lamp -->
  <ellipse cx="600" cy="706" rx="48" ry="11" fill="#1c1a18"/>
  <path d="M600 702 L612 590 L686 540" fill="none" stroke="#1c1a18" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="612" cy="590" r="7" fill="#2c2a28"/>
  <path d="M664 512 L716 500 L752 556 L650 576 Z" fill="#DB0000" stroke="#9c0000" stroke-width="3" stroke-linejoin="round"/>
  <ellipse class="lamp-light" cx="701" cy="566" rx="40" ry="8" transform="rotate(-11 701 566)" fill="#ffe7b8"/>

  <!-- pencil cup -->
  <path d="M1068 610 L1076 668" stroke="#f2b632" stroke-width="6" stroke-linecap="round"/>
  <path d="M1090 604 L1086 668" stroke="#DB0000" stroke-width="6" stroke-linecap="round"/>
  <path d="M1102 616 L1094 668" stroke="#e8e2d6" stroke-width="5" stroke-linecap="round"/>
  <rect x="1060" y="650" width="50" height="72" rx="5" fill="#2b2a28"/>
  <rect x="1060" y="650" width="50" height="6" rx="3" fill="#3c3a37"/>

  <!-- T-bird mug -->
  <path d="M1037 664 C1062 664 1062 700 1035 700" fill="none" stroke="#b30000" stroke-width="9" stroke-linecap="round"/>
  <path d="M984 652 L1038 652 L1034 716 Q1033 726 1022 726 L1000 726 Q989 726 988 716 Z" fill="#DB0000"/>
  <ellipse cx="1011" cy="652" rx="27" ry="6" fill="#7a0000"/>
  <path d="M1013 668 L1002 690 h8 l-4 18 l13 -24 h-8 l4 -12 z" fill="#fff"/>
  <g class="steam" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round">
    <path d="M1002 640 C994 628 1010 620 1002 606"/>
    <path d="M1020 640 C1012 628 1028 620 1020 606"/>
  </g>

  <!-- paper stack -->
  <path d="M928 812 L1044 800 L1052 846 L936 858 Z" fill="#e9e2d4"/>
  <path d="M924 806 L1040 794 L1048 840 L932 852 Z" fill="#f6f1e7"/>
  <path d="M944 814 L1020 806 M946 824 L1030 815 M948 834 L1004 828" stroke="rgba(22,21,19,.18)" stroke-width="2"/>

  <!-- SPARC nameplate -->
  <path d="M566 784 L700 784 L708 800 L558 800 Z" fill="#3a3632"/>
  <path d="M558 800 L708 800 L714 840 L552 840 Z" fill="#161513"/>
  <rect x="574" y="817" width="16" height="3" fill="#DB0000"/>
  <text x="600" y="826" font-family="${MONO}" font-weight="700" font-size="17" letter-spacing="4" fill="#fff">SPARC</text>

  <!-- night, lamplight, vignette -->
  <rect width="1600" height="900" fill="#0a0c18" opacity=".34"/>
  <rect class="lamp-light" x="380" y="400" width="800" height="500" fill="url(#sc-lamp)"/>
  <rect width="1600" height="900" fill="url(#sc-vignette)"/>
</svg>`;
}

export function birdSVG() {
  return `<svg viewBox="0 0 420 280" aria-hidden="true">
  <defs>
    <linearGradient id="tb-wing" x1="220" y1="124" x2="70" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#DB0000"/><stop offset=".55" stop-color="#b80000"/><stop offset="1" stop-color="#2a0606"/>
    </linearGradient>
    <linearGradient id="tb-wing-far" x1="212" y1="120" x2="70" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8f0000"/><stop offset="1" stop-color="#1e0505"/>
    </linearGradient>
  </defs>
  <g class="wing far">
    <path d="M214 118 C196 86 166 50 120 22 C134 44 140 56 142 66 C122 54 100 48 76 48 C98 64 110 74 116 84 C100 80 84 80 62 84 C98 98 146 114 182 128 Z" fill="url(#tb-wing-far)" stroke="#161513" stroke-width="3" stroke-linejoin="round"/>
  </g>
  <g class="tail">
    <path d="M128 140 L76 124 L98 142 L44 148 L94 156 L66 176 L132 154 Z" fill="#DB0000" stroke="#DB0000" stroke-width="10" stroke-linejoin="round"/>
    <path d="M128 140 L76 124 L98 142 L44 148 L94 156 L66 176 L132 154 Z" fill="#fff" stroke="#161513" stroke-width="3" stroke-linejoin="round"/>
  </g>
  <g fill="none" stroke="#161513" stroke-linecap="round">
    <path d="M228 158 L236 190" stroke-width="7"/>
    <path d="M248 156 L242 190" stroke-width="7"/>
    <path d="M226 194 Q238 186 250 194 M228 194 L223 203 M238 192 L238 203 M248 194 L253 203" stroke-width="3.5"/>
  </g>
  <path d="M124 140 C152 116 214 104 262 108 C290 110 306 122 306 134 C300 150 270 160 236 164 C194 168 152 160 124 146 Z" fill="#161513" stroke="#DB0000" stroke-width="4" stroke-linejoin="round"/>
  <path d="M252 150 l14 -10 M234 156 l14 -11 M216 158 l14 -11" stroke="#DB0000" stroke-width="3" stroke-linecap="round"/>
  <path d="M286 104 L258 92 L276 110 L250 112 L276 120 L258 132 L292 124 Z" fill="#fff" stroke="#161513" stroke-width="3" stroke-linejoin="round"/>
  <path d="M276 112 C282 82 318 66 348 72 C364 76 374 86 378 98 L382 120 C370 134 340 140 316 138 C296 136 282 128 276 112 Z" fill="#DB0000" stroke="#DB0000" stroke-width="12" stroke-linejoin="round"/>
  <path d="M276 112 C282 82 318 66 348 72 C364 76 374 86 378 98 L382 120 C370 134 340 140 316 138 C296 136 282 128 276 112 Z" fill="#fff" stroke="#161513" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M360 92 C382 88 404 98 408 114 C410 124 404 132 396 134 C398 124 392 116 382 114 L362 116 Z" fill="#efe9de" stroke="#161513" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M366 114 L390 118" stroke="#161513" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M346 108 C328 116 306 116 286 108 C300 124 328 126 352 114 Z" fill="#161513"/>
  <path d="M320 86 L368 90 L356 100 L328 98 Z" fill="#161513"/>
  <circle cx="348" cy="104" r="5.5" fill="#DB0000"/>
  <circle cx="349.5" cy="104" r="2.4" fill="#161513"/>
  <g class="wing near">
    <path d="M222 120 C204 76 174 36 122 8 C140 36 148 50 152 62 C128 46 104 38 76 36 C102 54 116 66 124 78 C104 70 84 68 58 70 C86 84 104 94 118 102 C102 102 88 104 72 110 C120 124 172 136 226 136 Z" fill="url(#tb-wing)" stroke="#161513" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M222 120 C204 76 174 36 122 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    <path d="M152 62 C170 84 190 104 214 122 M124 78 C150 96 176 112 210 126 M118 102 C150 112 180 122 214 130" fill="none" stroke="#161513" stroke-width="2" opacity=".55"/>
  </g>
</svg>`;
}
