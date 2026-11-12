// The Bibliothek's stories, written for Brightville: a few scenes read aloud with a picture each,
// then three questions answered by tapping a picture.

export interface Scene {
  picture: string
  text: string
}

export interface StoryQuestion {
  ask: string
  /** Pictures to tap, with what the voice says for each */
  choices: { picture: string; say: string }[]
  answer: number
}

export interface Story {
  id: string
  title: string
  scenes: Scene[]
  questions: StoryQuestion[]
}

export const STORIES: Story[] = [
  {
    id: 'baer',
    title: 'Der kleine Bär und der Honig',
    scenes: [
      { picture: '🐻🌳', text: 'Der kleine Bär wacht unter einem grossen Baum auf. Er hat Hunger.' },
      { picture: '🐻🐝', text: 'Eine Biene fliegt vorbei. Der Bär fragt: Weisst du, wo es Honig gibt?' },
      { picture: '🐝🌼🌼', text: 'Die Biene zeigt ihm eine Wiese voller gelber Blumen.' },
      { picture: '🍯😋', text: 'Neben den Blumen steht ein Topf mit Honig. Der Bär darf ein bisschen naschen.' },
      { picture: '🐻💛🐝', text: 'Der Bär sagt danke. Die Biene summt fröhlich weiter.' },
    ],
    questions: [
      {
        ask: 'Wer hat dem Bären geholfen?',
        choices: [{ picture: '🐸', say: 'Der Frosch' }, { picture: '🐝', say: 'Die Biene' }, { picture: '🦊', say: 'Der Fuchs' }],
        answer: 1,
      },
      {
        ask: 'Welche Farbe hatten die Blumen?',
        choices: [{ picture: '🟡', say: 'Gelb' }, { picture: '🔵', say: 'Blau' }, { picture: '🔴', say: 'Rot' }],
        answer: 0,
      },
      {
        ask: 'Was hat der Bär genascht?',
        choices: [{ picture: '🥕', say: 'Eine Karotte' }, { picture: '🍕', say: 'Eine Pizza' }, { picture: '🍯', say: 'Honig' }],
        answer: 2,
      },
    ],
  },
  {
    id: 'katze',
    title: 'Mimi im Regen',
    scenes: [
      { picture: '🐱🪟', text: 'Mimi die Katze sitzt am Fenster und schaut hinaus.' },
      { picture: '🌧️', text: 'Draussen regnet es. Die Tropfen machen plitsch, platsch.' },
      { picture: '🐱☂️', text: 'Mimi will trotzdem hinaus. Sie nimmt ihren roten Regenschirm mit.' },
      { picture: '🐱🐸', text: 'Im Garten trifft sie einen Frosch. Der Frosch liebt den Regen.' },
      { picture: '🌈🐱', text: 'Dann hört der Regen auf, und am Himmel leuchtet ein Regenbogen.' },
    ],
    questions: [
      {
        ask: 'Was hat Mimi mitgenommen?',
        choices: [{ picture: '🎈', say: 'Einen Ballon' }, { picture: '☂️', say: 'Einen Regenschirm' }, { picture: '🧸', say: 'Einen Teddy' }],
        answer: 1,
      },
      {
        ask: 'Wen hat Mimi im Garten getroffen?',
        choices: [{ picture: '🐸', say: 'Einen Frosch' }, { picture: '🐶', say: 'Einen Hund' }, { picture: '🐦', say: 'Einen Vogel' }],
        answer: 0,
      },
      {
        ask: 'Was war am Ende am Himmel?',
        choices: [{ picture: '🌙', say: 'Der Mond' }, { picture: '⚡', say: 'Ein Blitz' }, { picture: '🌈', say: 'Ein Regenbogen' }],
        answer: 2,
      },
    ],
  },
  {
    id: 'fuchs',
    title: 'Der Fuchs und die Äpfel',
    scenes: [
      { picture: '🦊🌳', text: 'Ein Fuchs kommt zu einem Apfelbaum.' },
      { picture: '🍎🍎🍎', text: 'Am Baum hängen drei rote Äpfel.' },
      { picture: '🌬️🍎', text: 'Der Wind weht, und ein Apfel fällt herunter.' },
      { picture: '🦊🍎', text: 'Der Fuchs hebt den Apfel auf und bringt ihn seiner Grossmutter.' },
      { picture: '👵🥧', text: 'Die Grossmutter backt daraus einen Apfelkuchen. Mmmh!' },
    ],
    questions: [
      {
        ask: 'Wie viele Äpfel hingen am Baum?',
        choices: [{ picture: '🍎', say: 'Einer' }, { picture: '🍎🍎', say: 'Zwei' }, { picture: '🍎🍎🍎', say: 'Drei' }],
        answer: 2,
      },
      {
        ask: 'Wer hat den Apfel heruntergeholt?',
        choices: [{ picture: '🌬️', say: 'Der Wind' }, { picture: '🐿️', say: 'Ein Eichhörnchen' }, { picture: '🐦', say: 'Ein Vogel' }],
        answer: 0,
      },
      {
        ask: 'Was hat die Grossmutter gebacken?',
        choices: [{ picture: '🍪', say: 'Kekse' }, { picture: '🥧', say: 'Einen Apfelkuchen' }, { picture: '🥨', say: 'Eine Brezel' }],
        answer: 1,
      },
    ],
  },
  {
    id: 'maus',
    title: 'Die Maus und das Nussboot',
    scenes: [
      { picture: '🐭🌰', text: 'Eine kleine Maus baut sich ein Boot aus einer Nussschale.' },
      { picture: '🍃⛵', text: 'Ein grünes Blatt wird ihr Segel.' },
      { picture: '🐭🌊', text: 'Die Maus fährt über den See. Die Wellen schaukeln das Boot hin und her.' },
      { picture: '🦆🐭', text: 'Eine Ente schwimmt neben ihr her und ruft: Quak, hallo!' },
      { picture: '🏝️😴', text: 'Am Abend kommt die Maus auf einer kleinen Insel an und schläft ein.' },
    ],
    questions: [
      {
        ask: 'Wer ist mit dem Boot gefahren?',
        choices: [{ picture: '🐘', say: 'Ein Elefant' }, { picture: '🐰', say: 'Ein Hase' }, { picture: '🐭', say: 'Die Maus' }],
        answer: 2,
      },
      {
        ask: 'Was war das Segel?',
        choices: [{ picture: '🍃', say: 'Ein Blatt' }, { picture: '🧦', say: 'Eine Socke' }, { picture: '📄', say: 'Ein Papier' }],
        answer: 0,
      },
      {
        ask: 'Wer ist neben dem Boot geschwommen?',
        choices: [{ picture: '🐟', say: 'Ein Fisch' }, { picture: '🦆', say: 'Eine Ente' }, { picture: '🐢', say: 'Eine Schildkröte' }],
        answer: 1,
      },
    ],
  },
]

/** A story at random, never the one before. */
export function pickStory(last: string | null, random: () => number = Math.random): Story {
  const choices = STORIES.filter(s => s.id !== last)
  return choices[Math.floor(random() * choices.length)]
}
