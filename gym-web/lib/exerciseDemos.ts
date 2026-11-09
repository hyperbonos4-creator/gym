export type ExerciseSetup = {
  pack: string;
  machine: string;
  place: string;
  grip: string;
};

export const SETUPS: Record<string, ExerciseSetup> = {
  "curl-mancuernas": {
    pack: "Dumbbell_Bicep_Curl",
    machine: "Par de mancuernas",
    place: "De pie, pies al ancho de cadera, costillas abajo.",
    grip: "Palmas al frente. Codos pegados al torso. No sueltes el mango en el pico.",
  },
  "dominadas-supino": {
    pack: "Chin-Up",
    machine: "Barra fija",
    place: "Cuelga con el cuerpo largo. Pies quietos, sin balanceo.",
    grip: "Palmas hacia ti, al ancho de hombros. Aprieta la barra como si la quisieras partir.",
  },
  "encogimiento-hombros": {
    pack: "Dumbbell_Shrug",
    machine: "Mancuernas pesadas",
    place: "De pie, brazos largos al costado. Rodillas suaves.",
    grip: "Neutro, a los lados del muslo. Sube solo los hombros, no flexiones el codo.",
  },
  "extension-pierna": {
    pack: "Leg_Extensions",
    machine: "Silla extensora de cuádriceps",
    place: "Espalda pegada al respaldo. El eje de la máquina alinea con tu rodilla.",
    grip: "Manos en las asas laterales. El rodillo queda sobre el empeine, no en la tibia.",
  },
  "femoral-maquina": {
    pack: "Lying_Leg_Curls",
    machine: "Femoral acostado",
    place: "Boca abajo. Cadera clavada al banco. Rodillas en el eje de giro.",
    grip: "Asas delanteras. El rodillo va arriba del talón, nunca en el hueco de la rodilla.",
  },
  "elevacion-frontal": {
    pack: "Front_Dumbbell_Raise",
    machine: "Mancuernas livianas",
    place: "De pie, mancuernas al muslo. Abdomen firme.",
    grip: "Palmas hacia atrás o neutras. Sube hasta la línea de los ojos, sin encoger el cuello.",
  },
  "jalon-abierto": {
    pack: "Wide-Grip_Lat_Pulldown",
    machine: "Polea alta / jalón",
    place: "Siéntate, muslos anclados bajo el soporte. Torso largo.",
    grip: "Barra más ancha que hombros, palmas adelante. Tira con los codos, no con las muñecas.",
  },
  "jalon-cerrado": {
    pack: "Close-Grip_Front_Lat_Pulldown",
    machine: "Polea alta + triángulo / agarre cerrado",
    place: "Misma silla del jalón. Pecho alto.",
    grip: "Manos juntas o triángulo. Codos pegados al cuerpo. Lleva el agarre al esternón.",
  },
  "press-banca": {
    pack: "Barbell_Bench_Press_-_Medium_Grip",
    machine: "Banco plano + barra",
    place: "Ojos bajo la barra. Pies firmes. Omóplatos juntos y abajo.",
    grip: "Un poco más ancho que hombros. Barra en la palma, no en los dedos. Muñeca apilada.",
  },
  sentadilla: {
    pack: "Barbell_Squat",
    machine: "Barra en rack / peso corporal",
    place: "Barra sobre el trapecio, no sobre el cuello. Pies un poco más abiertos que cadera.",
    grip: "Manos fijas en la barra, cerca de los hombros. Codillos hacia abajo.",
  },
  "peso-muerto-rumano": {
    pack: "Romanian_Deadlift",
    machine: "Barra o mancuernas",
    place: "De pie, barra pegada al muslo. Rodillas apenas flexionadas.",
    grip: "Prono, al ancho de hombros. La barra roza el muslo en todo el recorrido.",
  },
  "press-militar": {
    pack: "Barbell_Shoulder_Press",
    machine: "Barra o mancuernas (empuje vertical)",
    place: "De pie o sentado. Costillas abajo, glúteos apretados.",
    grip: "Barra a la clavícula. Muñecas sobre los codos. Empuja arriba y un poco atrás.",
  },
  "remo-barra": {
    pack: "Bent_Over_Barbell_Row",
    machine: "Barra",
    place: "Cadera atrás, torso a 45°, espalda larga.",
    grip: "Prono, un poco más ancho que hombros. Tira la barra al abdomen, no al pecho.",
  },
  fondos: {
    pack: "Dips_-_Triceps_Version",
    machine: "Paralelas",
    place: "Brazos bloqueados, cuerpo casi vertical para tríceps.",
    grip: "Manos al ancho de hombros. Empuja el mango hacia abajo, hombros lejos de las orejas.",
  },
  plancha: {
    pack: "Plank",
    machine: "Piso / colchoneta",
    place: "Antebrazos y puntas de pies. Cuerpo en línea.",
    grip: "Codos bajo los hombros. Puños o palmas. No dejes caer la cadera.",
  },
  "hip-thrust": {
    pack: "Barbell_Hip_Thrust",
    machine: "Banco + barra (o peso corporal)",
    place: "Omóplatos en el borde del banco. Pies firmes, tibias verticales arriba.",
    grip: "Barra sobre la cadera (usa pad). Sujétala para que no ruede. Mentón metido.",
  },
  "elevacion-lateral": {
    pack: "Side_Lateral_Raise",
    machine: "Mancuernas livianas",
    place: "De pie, mancuernas al costado. Rodillas suaves.",
    grip: "Neutro. Codo un poco más alto que la muñeca. Hasta la línea del hombro.",
  },
  aperturas: {
    pack: "Dumbbell_Flyes",
    machine: "Banco plano + mancuernas",
    place: "Omóplatos juntos. Mancuernas sobre el pecho al inicio.",
    grip: "Neutro. Codos semiflexionados (abrazo). No bajes más de lo que el hombro tolera.",
  },
  zancadas: {
    pack: "Dumbbell_Lunges",
    machine: "Mancuernas o peso corporal",
    place: "Paso largo. Torso largo. Rodilla delantera sobre el medio del pie.",
    grip: "Mancuernas a los costados, brazos largos. No dejes que te jalen hacia adelante.",
  },
  "curl-martillo": {
    pack: "Hammer_Curls",
    machine: "Mancuernas",
    place: "De pie, palmas enfrentadas.",
    grip: "Neutro: pulgares arriba. Codos fijos. Sube como si llevaras un maletín.",
  },
  "extension-triceps": {
    pack: "Triceps_Pushdown",
    machine: "Polea alta (barra o cuerda)",
    place: "De pie, cerca de la polea. Codos pegados al cuerpo.",
    grip: "Barra: pronación. Cuerda: abre al final. Solo mueve el antebrazo.",
  },
  "elevacion-pantorrilla": {
    pack: "Standing_Calf_Raises",
    machine: "Máquina de pantorrilla o escalón",
    place: "Metatarso en el borde. Cuerpo largo.",
    grip: "Manos en los soportes. No rebotes. Talón baja hasta el estiramiento.",
  },
};
