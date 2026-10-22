'use strict';

const APP_QUOTES = [
  { text: 'I\'m not lazy; I\'m on energy-saving mode.' },
  { text: 'My bed and I are in a committed relationship.' },
  { text: 'I need six months of vacation, twice a year.' },
  { text: 'When life gives you lemons, add them to your story.' },
  { text: 'I put the Pro in procrastinate.' },
  { text: 'Why fall in love when you can fall asleep?' },
  { text: 'If we shouldn\'t eat at night, why is there a light in the fridge?' },
  { text: 'You\'re the main character — act like it.', author: 'Maya, 20' },
  { text: 'Life\'s too short to be anything but completely yourself.', author: 'Mia, 22' },
  { text: 'Your vibe attracts your tribe — choose your energy wisely.', author: 'Jalen, 19' },
  { text: 'Dream big, fail hard, and get up even stronger.', author: 'Zoe, 23' },
  { text: 'Every moment is a chance to create the future you want. Don\'t waste it.', author: 'Ethan, 21' },
  { text: 'The path isn\'t straight, but trust me, it\'s worth the detours.', author: 'Lucas, 24' },
  { text: 'You don\'t need to have it all figured out. You just need to start.', author: 'Layla, 20' },
  { text: 'Growth happens in the uncomfortable moments — lean into them.', author: 'Jordan, 22' },
  { text: 'Stop chasing perfection, start chasing progress.', author: 'Kayla, 19' },
  { text: 'If the vibe\'s off, don\'t force it. Let go and make space for what\'s meant for you.', author: 'Ruby, 23' },
  { text: 'Your past doesn\'t define you. How you respond to it does.', author: 'Taylor, 21' },
  { text: 'The world won\'t always be kind, but you should be.', author: 'Brianna, 25' },
  { text: 'Create more than you consume — that\'s the key to happiness.', author: 'Max, 20' },
  { text: 'You\'ve got one life. Live it for you, not the likes.', author: 'Sophie, 19' },
  { text: 'We\'re all just a work in progress, and that\'s okay.', author: 'Jaden, 22' },
  { text: 'Comparison is the thief of joy. Focus on your own journey.', author: 'Aliyah, 24' },
  { text: 'Don\'t wait for permission to take up space — own it.', author: 'Daniel, 21' },
  { text: 'The best things happen outside of your comfort zone.', author: 'Chris, 23' },
  { text: 'You are not your thoughts. You are the action you take after them.', author: 'Emma, 20' },
  { text: 'Make mistakes. It means you\'re trying.', author: 'Olivia, 19' },
  { text: 'Do it scared. Do it unsure. Just do it.', author: 'Harper, 22' },
  { text: 'Success isn\'t about the destination; it\'s about the lessons you pick up along the way.', author: 'Noah, 24' },
  { text: 'Self-love isn\'t selfish — it\'s essential.', author: 'Kayden, 20' },
  { text: 'The only competition that matters is who you were yesterday.', author: 'Sophie, 23' },
  { text: 'In the end, the people who stay with you through your worst are the real ones.', author: 'Mia, 21' },
  { text: 'Let life surprise you. The best moments are the unexpected ones.', author: 'Jalen, 19' },
  { text: 'Fear kills more dreams than failure ever will.', author: 'Ali, 20' },
  { text: 'Don\'t dim your light just because it\'s making someone else uncomfortable.', author: 'Ruby, 22' },
  { text: 'Chase the dream that scares you most — it\'s the one worth having.', author: 'Emily, 25' },
  { text: 'You\'re allowed to change your mind and switch paths. It\'s your life.', author: 'Zoe, 20' },
  { text: 'Live for the moments that make you forget to check your phone.', author: 'Ethan, 23' },
  { text: 'Your mental health matters more than your productivity. Take care of it.', author: 'Brianna, 21' },
  { text: 'Don\'t be afraid to take up space in rooms where you once felt small.', author: 'Taylor, 24' },
  { text: 'You don\'t need all the answers to start — you just need courage.', author: 'Maya, 22' },
  { text: 'Find your people, and hold on to them tight. They make the chaos worth it.', author: 'Jake, 20' },
  { text: 'Your weirdness is your power. Don\'t hide it.', author: 'Max, 21' },
  { text: 'If it doesn\'t scare you, you\'re not dreaming big enough.', author: 'Olivia, 23' },
  { text: 'You can\'t pour from an empty cup. Take care of yourself first.', author: 'Chris, 22' },
  { text: 'Time is your most valuable currency — spend it wisely.', author: 'Jaden, 20' },
  { text: 'Be kind to yourself on the bad days. They don\'t define you.', author: 'Sophie, 25' },
  { text: 'You can always restart. Life\'s not a one-way street.', author: 'Emma, 19' },
  { text: 'Learn to rest, not quit.', author: 'Layla, 22' },
  { text: 'The world is messy, but your mindset doesn\'t have to be.', author: 'Lucas, 24' },
  { text: 'Be a masterpiece and a work in progress, all at once.', author: 'Kayla, 21' },
  { text: 'Confidence is quiet. Insecurity is loud.', author: 'Ruby, 23' },
  { text: 'The only limits that exist are the ones you set for yourself.', author: 'Noah, 25' },
  { text: 'Trust the process, even when it feels slow.', author: 'Jordan, 22' },
  { text: 'You\'ve got one life — live it without apology.', author: 'Daniel, 24' },
  { text: 'Authenticity is my rebellion.' },
  { text: 'Becoming is better than being.' },
  { text: 'I\'m the plot twist in my family tree.' },
  { text: 'Life\'s too short for bad vibes and boring clothes.' },
  { text: 'Turned my can\'ts into cans and my dreams into plans.' },
  { text: 'Offline is the new luxury.' },
  { text: '404 Error: social life not found.' },
  { text: 'Survived another day without charging my social batteries.' },
  { text: 'Alexa, pay my bills and make me coffee.' },
  { text: 'Wi-Fi went down for five minutes, so I had to talk to my family. They seem nice.' },
  { text: 'Less ghosting, more toasting to real connections.' },
  { text: 'Sleep is my business plan.' },
  { text: 'The dream is free; the hustle is sold separately.' },
  { text: 'Caffeine-dependent life form.' },
  { text: 'Pursuing my purpose, not just the paycheck.' },
  { text: 'Side hustles are the new job security.' },
  { text: 'Emails down, inner peace up.' },
  { text: 'Collect moments, not things.' },
  { text: 'Let\'s travel where the Wi-Fi is weak and the bond is strong.' },
  { text: 'Breaking up with my comfort zone.' },
  { text: 'Currently dating my passport.' },
  { text: 'In my defense, I was left unsupervised.' },
  { text: 'Working on myself, by myself, for myself.' },
  { text: 'Self-care isn\'t selfish, it\'s survival.' },
  { text: 'There is no Planet B.' },
  { text: 'Nature: cheaper than therapy.' },
  { text: 'Got more issues than Vogue and I\'m okay with it.' },
  { text: 'Waiting for my life to be adapted into a movie.' },
  { text: 'My playlist understands me.' },
  { text: 'Binge-watching is my cardio.' },
  { text: 'Inhale confidence, exhale doubt.' },
  { text: 'Doing less, to experience more.' },
  { text: 'Staying present is my present to myself.' },
  { text: 'My inner child deserves a high five.' },
  { text: 'Balance isn\'t found, it\'s created.' },
  { text: 'Life update: still a mess.' },
  { text: 'Adulting is soup, and I am a fork.' },
  { text: 'Sarcasm, my default language.' },
  { text: 'Trying to be an adult but it\'s complicated.' },
  { text: 'Doing it scared, but doing it nonetheless.' },
  { text: 'Create the things you wish existed.' },
  { text: 'Courage over comfort every single time.' },
  { text: 'I bend so I don\'t break.' },
  { text: 'You can\'t do a good job if your job is all you do.', author: 'Katie Thurmes' },
  { text: 'Don\'t confuse having a career with having a life.', author: 'Hillary Clinton' },
  { text: 'Never get so busy making a living that you forget to make a life.', author: 'Dolly Parton' },
  { text: 'The bad news is time flies. The good news is you\'re the pilot.', author: 'Michael Altshuler' },
  { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'We accept the love we think we deserve.', author: 'Stephen Chbosky' },
  { text: 'In a world where you can be anything, be kind.' },
  { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
  { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
  { text: 'Do one thing every day that scares you.', author: 'Eleanor Roosevelt' },
  { text: 'The only way out is through.' },
  { text: 'Done is better than perfect.' },
  { text: 'No is a complete sentence.' },
  { text: 'Protect your peace.' },
  { text: 'Touch grass.' },
  { text: 'I don\'t dream of labor.' },
  { text: 'Work to live, don\'t live to work.' },
  { text: 'Your job will replace you in a week. Your people won\'t.' },
  { text: 'Work is not your life. Your worth is not defined by your productive output.' },
  { text: 'Soft life is still a life.' },
  { text: 'Rest is productive.' },
  { text: 'Normalize doing nothing.' },
  { text: 'If it\'s not a hell yes, it\'s a no.' },
  { text: 'Boundaries are a love language.' },
  { text: 'Healing is not linear.' },
  { text: 'Plot twist: I chose myself.' },
  { text: 'Delulu is the solulu.' },
  { text: 'Let them.' },
  { text: 'Romanticize your life.' },
  { text: 'You don\'t owe anyone an explanation.' },
  { text: 'I\'m not behind. I\'m on my own timeline.' },
  { text: 'Go where you\'re celebrated, not tolerated.' },
  { text: 'Energy doesn\'t lie.' },
  { text: 'What you allow is what will continue.' },
  { text: 'That\'s a them problem.' },
  { text: 'I\'m in my villain era.' },
  { text: 'Do it for the plot.' },
  { text: 'It is what it is.' },
  { text: 'No thoughts, just vibes.' },
  { text: 'I understood the assignment.' },
  { text: 'We ball.' },
  { text: 'Please don\'t perceive me.' },
  { text: 'Currently buffering.' },
  { text: 'Low battery, high hopes.' },
  { text: 'I manifested this... I think.' },
  { text: 'My 9-to-5 funds my 5-to-9.' },
  { text: 'Rent is the final boss.' },
  { text: 'Coffee first, adulting second.' },
  { text: 'My personality is 47 open tabs.' },
  { text: 'Ctrl+Z my entire 20s.' },
  { text: 'Group chat mute: on. Inner peace: loading.' },
  { text: 'This meeting could have been a nap.' },
  { text: 'I\'m not lost, I\'m collecting B-roll.' },
  { text: 'Healing era, but make it chaotic.' },
  { text: 'I brought snacks and mild anxiety.' },
  { text: 'Living proof that you can be tired and still pretty funny.' },
  { text: 'My Roman Empire is going to bed on time.' },
  { text: 'If it\'s meant for me, it won\'t require me to shrink.' },
  { text: 'Quiet quitting the version of me that said yes to everything.' },
  { text: 'Protecting my peace like it\'s limited edition.' },
  { text: 'I\'m not dramatic, I\'m just narrating.' },
  { text: 'Life\'s a group project and I\'m doing all the slides.' },
  { text: 'I\'m thriving adjacent.' },
  { text: 'Currently in my reply-later era.' },
  { text: 'The algorithm thinks I have my life together. Cute.' },
  { text: 'I scheduled joy like it\'s a meeting. That\'s growth.' },
  { text: 'If you need me, I\'ll be romanticizing a grocery run.' },
  { text: 'My toxic trait is thinking I can do it all before noon.' },
  { text: 'I left my comfort zone. It keeps texting me to come back.' },
  { text: 'Today\'s forecast: overthinking with a chance of snacks.' },
  { text: 'I put my phone down and immediately picked it back up. Nature is healing.' },
  { text: 'It\'s giving I have 12 unfinished hobbies.' },
  { text: 'I don\'t have a 5-year plan. I have a 5-song playlist and a snack.' },
  { text: 'I came, I saw, I left early.' },
  { text: 'Main character who forgot the script.' },
  { text: 'It\'s giving I tried.' },
  { text: 'The vibes are in HD today.' },
  { text: 'Out of office in my mind.' },
  { text: 'I googled it so I\'m basically an expert.' },
  { text: 'My love language is leaving me alone.' },
  { text: 'Introverted but willing to discuss memes.' },
  { text: 'Please hold, I\'m overthinking.' },
  { text: 'Emotionally unavailable? No. Emotionally buffering.' },
  { text: 'I\'ll start tomorrow, said every yesterday.' },
  { text: 'Adulting is just a fancy word for figuring it out as you go.' },
  { text: 'Wi-Fi is my oxygen.' },
  { text: 'Making the world a better place one meme at a time.' },
  { text: 'Stressed, blessed, and coffee obsessed.' },
  { text: 'We\'re not quiet quitting — we\'re loudly regretting.' },
  { text: 'It\'s giving burnout chic.' },
  { text: 'My side hustle became my main hustle.' },
  { text: 'Have you tried crying and restarting?' },
  { text: 'We\'re all just one Slack message away from a mental health day.' },
  { text: 'Pajamas beat pantsuits. That\'s the whole remote-work thesis.' },
  { text: 'Open to work... and crying in the break room.' },
  { text: 'I am tired, and that is the whole speech.' },
  { text: 'Even Netflix is wondering if I\'m still watching.' },
  { text: 'You don\'t have to be the main character every day. NPC days are valid.' },
  { text: 'If I had a dollar for every tab I have open, I could maybe afford rent.' },
  { text: 'I\'m not ghosting you. My social battery is in low-power mode.' },
  { text: 'Soft launching my life together.' },
  { text: 'Hot girl walk, hot girl thoughts, lukewarm bank account.' },
  { text: 'Sunday scaries are just Monday\'s trailer.' },
  { text: 'I keep it 100... percent chaotic.' },
  { text: 'It is what it is, until I romanticize it.' },
  { text: 'I understood the assignment, then closed the laptop.' },
  { text: 'No thoughts, head empty, heart full of snacks.' },
  { text: 'This is fine. The fire is a vibe.' },
  { text: 'Ight, I\'mma head out — spiritually, if not physically.' },
  { text: 'They had us in the first half. Then adulting started.' },
  { text: 'Ain\'t nobody got time for that, including me.' },
  { text: 'We live in a society. I would like a nap in it.' },
  { text: 'I\'m once again asking for your financial support... from myself.' },
  { text: 'Started from the group chat, now we\'re here.' },
  { text: 'I stay curious. Also slightly unhinged.' },
  { text: 'Make it make sense, or make it a meme.' },
  { text: 'I\'m not late. I\'m on main-character time.' },
  { text: 'If nobody got me, my headphones got me.' },
  { text: 'I\'m building a life I don\'t need a vacation from. Currently in beta.' },
  { text: 'Healing looks like saying no and going to bed.' },
  { text: 'I can be the bigger person. After a snack.' },
  { text: 'Your 20s are just a loading screen. Be patient.' },
  { text: 'I\'m not inconsistent. I\'m seasonal.' },
  { text: 'The plot hole in my life is called Tuesday.' },
  { text: 'I put my energy where the Wi-Fi is strong and the people are kind.' },
  { text: 'If I disappear, I\'m probably in a grocery store deciding on cereal.' },
  { text: 'I\'m not overthinking. I\'m running simulations.' },
  { text: 'My comfort zone and I are in an open relationship.' },
  { text: 'I\'m one good playlist away from believing in myself again.' },
  { text: 'The bag can wait. My nervous system cannot.' },
  { text: 'I\'m not ignoring red flags. I\'m colorblind for a limited time only.' },
  { text: 'If it costs my peace, it\'s too expensive.' },
  { text: 'I\'m allowed to be a beginner in public.' },
  { text: 'My 30s can still be my origin story.' },
  { text: 'I don\'t need a glow-up. I need a lie-down.' },
  { text: 'I\'m not behind my peers. We are in different genres.' },
  { text: 'Some days you slay. Some days you survive. Both count.' },
  { text: 'I\'m collecting hobbies like they\'re limited drops.' },
  { text: 'If I wanted to be perceived, I would have gone outside.' },
  { text: 'My love language is sent memes and timely silence.' },
  { text: 'I\'m not addicted to my phone. We\'re in a situationship.' },
  { text: 'The best revenge is a well-hydrated, well-rested you.' },
  { text: 'I left the chat. The chat did not leave me.' },
  { text: 'I can do hard things. I would prefer not to, but I can.' },
  { text: 'I\'m not a morning person. I\'m a coffee person who happens to see mornings.' },
  { text: 'If the universe is testing me, I would like a study guide.' },
  { text: 'I\'m rewriting the group project called my life. Solo this time.' },
  { text: 'A little delusion is just hope with better branding.' },
  { text: 'I\'m not changing for anyone. I am changing for my future self, who is hotter and more hydrated.' },
  { text: 'Today I chose the version of me who answers the email and then touches grass.' },
  { text: 'I don\'t need to go viral. I need to go outside.' },
  { text: 'If I\'m extra, it\'s because basic never booked the flight.' },
  { text: 'I\'m the CEO of doing my best and then lying down about it.' },
  { text: 'My inner child wants juice. My inner adult wants a raise. We negotiate.' },
  { text: 'I\'m not lost in life. I\'m on an unreleased album era.' },
  { text: 'The standard is: be kind, drink water, mind your business.' },
  { text: 'I\'m not ghosting opportunities. I\'m waiting for the one that feels like a yes in my body.' },
  { text: 'If they wanted to, they would. If I wanted to, I would too. Boundaries.' },
  { text: 'I\'m a limited edition. Act accordingly, including me.' },
  { text: 'I can hold joy and dread in the same tote bag.' },
  { text: 'I\'m not dramatic. The economy is.' },
  { text: 'My 401(k) is a group chat named someday.' },
  { text: 'I\'m one good night of sleep away from being unstoppable. Or at least civil.' },
  { text: 'If it\'s not fun, it better be paid. If it\'s not paid, it better be fun.' },
  { text: 'I\'m not shrinking my dreams to fit a cubicle.' },
  { text: 'The world is loud. My headphones are a boundary.' },
  { text: 'I\'m allowed to outgrow rooms I used to pray to enter.' },
  { text: 'If I can\'t laugh at it, I can\'t carry it.' },
  { text: 'I\'m not waiting for motivation. I\'m negotiating with it.' },
  { text: 'A small life can still be a rich life.' },
  { text: 'I\'m not a brand. I\'m a person with a phone and a snack.' },
  { text: 'The most punk thing I did this week was go to bed on time.' },
  { text: 'I\'m not chasing clout. I\'m chasing a Tuesday that doesn\'t hurt.' },
  { text: 'If I disappear into a hobby, consider it self-care with extra steps.' },
  { text: 'I can be grateful and still want more. Both things are true.' },
  { text: 'I\'m not failing. I\'m gathering data.' },
  { text: 'My therapist would be proud. My laundry would not.' },
  { text: 'I\'m the plot twist I needed at 22 and the peace I needed at 28.' },
  { text: 'If the vibe is homework, I\'m skipping.' },
  { text: 'I\'m not anti-work. I\'m anti-being-a-shell-of-a-person.' },
  { text: 'Let the group chat cook. I\'m just here for the crumbs and the love.' },
  { text: 'I\'m not a backup plan. I\'m a whole itinerary.' },
  { text: 'Today\'s win: I showed up. Trophy pending.' },
  { text: 'I\'m in my soft era, which still includes deadlines and spite.' },
  { text: 'If I wanted chaos, I would open my email.' },
  { text: 'I\'m not reinventing myself. I\'m uninstalling old versions.' },
  { text: 'The universe said maybe. I said bet.' },
  { text: 'I\'m not for everybody, and that is the luxury package.' },
  { text: 'I put the hot in hotspot and the mess in message.' },
  { text: 'If my plants can survive me, I can survive this week.' },
  { text: 'I\'m not overcommitted. I\'m optimistic with poor calendar skills.' },
  { text: 'A nap is a strategy, not a personality. Today it is both.' },
  { text: 'I\'m choosing curiosity over doomscrolling. Starting... now. Okay one more reel.' },
  { text: 'If they can do it scared, I can do it slightly hydrated.' },
  { text: 'I\'m not waiting for the perfect time. I\'m using the messy one I have.' },
  { text: 'My future self sent a thank-you note. It was a calendar invite named rest.' },
  { text: 'I can be the vibe and still leave at 9.' },
  { text: 'I\'m not a machine. I\'m a limited-run human with needs.' },
  { text: 'If it\'s not aligned, it\'s not a missed opportunity. It\'s a dodge.' },
  { text: 'I\'m collecting evidence that I can start again.' },
  { text: 'The glow-up is just consistency in better lighting.' },
  { text: 'I\'m not hard to love. I\'m hard to rush.' },
  { text: 'If I speak it into existence, I also have to calendar it. Annoying, but fair.' },
  { text: 'I\'m the friend who says we should go out and then suggests a documentary.' },
  { text: 'Peace looks boring until you\'ve lived without it.' },
  { text: 'I\'m not a morning alarm. I\'m a slow sunrise with opinions.' },
  { text: 'If the world is a simulation, I would like to lower the difficulty.' },
  { text: 'I\'m doing my best, which is a moving target and also valid.' }
];

const QUOTE_LAST_KEY = 'terrabyte.quote.lastIndex';
const QUOTE_USED_KEY = 'terrabyte.quote.used';
const QUOTE_INTERVAL_MS = 10000;
const QUOTE_RING_CIRCUMFERENCE = 56.55;

function normalizeQuote(entry) {
  if (typeof entry === 'string') return { text: entry, author: '' };
  return { text: String(entry.text || ''), author: String(entry.author || '') };
}

function pickNextQuote() {
  const total = APP_QUOTES.length;
  if (!total) return { text: '', author: '' };

  let used = [];
  try {
    used = JSON.parse(localStorage.getItem(QUOTE_USED_KEY) || '[]');
  } catch {
    used = [];
  }
  if (!Array.isArray(used) || used.length >= total) used = [];

  const last = Number(localStorage.getItem(QUOTE_LAST_KEY));
  let available = [];
  for (let i = 0; i < total; i += 1) {
    if (!used.includes(i)) available.push(i);
  }
  if (available.length > 1 && Number.isFinite(last)) {
    available = available.filter((i) => i !== last);
  }
  if (!available.length) {
    available = APP_QUOTES.map((_, i) => i).filter((i) => i !== last);
  }
  if (!available.length) available = [0];

  const index = available[Math.floor(Math.random() * available.length)];
  used.push(index);
  localStorage.setItem(QUOTE_USED_KEY, JSON.stringify(used));
  localStorage.setItem(QUOTE_LAST_KEY, String(index));
  return normalizeQuote(APP_QUOTES[index]);
}

function applyQuote(quote) {
  const quoteEl = document.getElementById('app-quote');
  const textEl = document.getElementById('app-quote-text');
  const authorEl = document.getElementById('app-quote-author');
  if (!quoteEl || !textEl) return false;
  if (!quote.text) {
    quoteEl.classList.add('hidden');
    return false;
  }

  const swap = !quoteEl.classList.contains('hidden');
  const reduceMotion = document.body.classList.contains('no-animations')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (swap && !reduceMotion) quoteEl.classList.add('is-swap');

  const paint = () => {
    textEl.textContent = quote.text;
    quoteEl.title = quote.author ? `${quote.text} — ${quote.author}` : quote.text;
    if (authorEl) {
      if (quote.author) {
        authorEl.textContent = quote.author;
        authorEl.classList.remove('hidden');
      } else {
        authorEl.textContent = '';
        authorEl.classList.add('hidden');
      }
    }
    quoteEl.classList.remove('hidden', 'is-swap');
  };

  if (swap && !reduceMotion) setTimeout(paint, 160);
  else paint();
  return true;
}

function setQuoteProgress(remaining) {
  const progressEl = document.getElementById('app-quote-progress');
  const ringEl = document.getElementById('app-quote-timer-fill');
  const value = Math.max(0, Math.min(1, remaining));
  if (progressEl) progressEl.style.transform = `scaleX(${value})`;
  if (ringEl) {
    ringEl.style.strokeDasharray = String(QUOTE_RING_CIRCUMFERENCE);
    ringEl.style.strokeDashoffset = String(QUOTE_RING_CIRCUMFERENCE * (1 - value));
  }
}

function startQuoteRotation() {
  const quoteEl = document.getElementById('app-quote');
  if (!quoteEl || !applyQuote(pickNextQuote())) return;

  let startedAt = performance.now();
  let pausedAt = 0;
  let raf = 0;

  const tick = (now) => {
    if (pausedAt) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const elapsed = now - startedAt;
    setQuoteProgress(1 - elapsed / QUOTE_INTERVAL_MS);
    if (elapsed >= QUOTE_INTERVAL_MS) {
      applyQuote(pickNextQuote());
      startedAt = now;
      setQuoteProgress(1);
    }
    raf = requestAnimationFrame(tick);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pausedAt = performance.now();
      return;
    }
    if (pausedAt) {
      startedAt += performance.now() - pausedAt;
      pausedAt = 0;
    }
  });

  setQuoteProgress(1);
  raf = requestAnimationFrame(tick);
  window.addEventListener('beforeunload', () => cancelAnimationFrame(raf), { once: true });
}

startQuoteRotation();
