#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère 1064 cartes « brulant » (616 actions + 448 vérités)
+ 2000 cartes « hardcore » (1160 actions + 840 vérités)
+ 6500 cartes « hardcore++ » (2972 actions + 3528 vérités), puis reconstruit :
  - cards.json          (436 + 1064 + 2000 + 6500 = 10000 cartes)
  - supabase.sql        (installation complète)
  - migration_cards.sql (migration pour base existante)
"""
import json
import random

random.seed(7)

# ----------------------------------------------------------------------
# 1) Lire les 436 cartes existantes (dédup)
# ----------------------------------------------------------------------
raw = open("/home/user/uploads/Json a ou v.txt", encoding="utf-8").read()
lines = raw.split("\n")
start = next(i for i, l in enumerate(lines) if l.strip() == "[")
end = next(i for i, l in enumerate(lines) if l.strip() == "]")
src = json.loads("\n".join(lines[start:end + 1]))

TYPE = {"verite": "truth", "action": "dare"}
existing_texts = {d["text"] for d in src}

# ----------------------------------------------------------------------
# 2) Slots partagés
# ----------------------------------------------------------------------
P = [
    "la personne à ta droite",
    "la personne à ta gauche",
    "la personne en face de toi",
    "la personne de ton choix",
    "quelqu'un qui accepte",
    "la personne la plus proche de toi",
]
ZMASS = [
    "le cou", "la nuque", "les épaules", "les tempes", "le cuir chevelu",
    "le bas du dos", "les mains", "les avant-bras", "les mollets",
    "les omoplates", "le visage", "les pieds", "le ventre", "les trapèzes",
    "les hanches", "le sternum",
]
ZKISS = [
    "le cou", "la nuque", "la clavicule", "l'épaule", "le lobe de l'oreille",
    "l'intérieur du poignet", "le creux du coude", "le bas du dos",
    "le ventre", "la mâchoire", "le sternum", "l'intérieur du bras",
    "la cheville", "le genou", "la tempe", "le dos de la main",
]
ZSOUFFLE = ["le cou", "l'oreille", "la nuque"]
D = ["15 secondes", "20 secondes", "30 secondes", "1 minute", "2 minutes"]

# ----------------------------------------------------------------------
# 3) Génération des actions (candidates)
# ----------------------------------------------------------------------
action_candidates = []
for p in P:
    for z in ZMASS:
        for d in D:
            action_candidates.append(f"Masse {z} de {p} pendant {d}, de façon très sensuelle.")
    for z in ZKISS:
        for d in D:
            action_candidates.append(f"Embrasse {z} de {p} pendant {d}.")
            action_candidates.append(f"Mordille doucement {z} de {p} pendant {d}.")
            action_candidates.append(f"Fais glisser un glaçon sur {z} de {p} pendant {d}.")
            action_candidates.append(f"Fais glisser tes doigts très lentement sur {z} de {p} pendant {d}.")
        action_candidates.append(f"Lèche lentement {z} de {p}.")
        action_candidates.append(f"Fais un suçon léger sur {z} de {p}.")
    for z in ZSOUFFLE:
        for d in D:
            action_candidates.append(f"Souffle doucement dans {z} de {p} pendant {d}.")
    action_candidates.append(f"Chuchote une phrase très osée à l'oreille de {p}.")
    for d in D:
        action_candidates.append(f"Regarde {p} droit dans les yeux pendant {d}, sans détourner le regard.")

CURATED_ACTIONS = [
    "Bande les yeux de la personne de ton choix, puis fais-lui deviner un objet au toucher.",
    "Fais goûter un aliment à la personne en face de toi en le tenant entre tes lèvres.",
    "Fais un body shot au miel sur le cou de la personne de ton choix.",
    "Attache les poignets de quelqu'un qui accepte avec une écharpe pendant 2 minutes.",
    "Fais deviner un mot en le traçant avec ton doigt dans le dos de la personne à ta gauche.",
    "Récite les jours de la semaine en posant tes lèvres sur le cou de la personne à ta droite entre chaque mot.",
    "Fais un câlin de 30 secondes à la personne de ton choix en respirant dans son cou.",
    "Glisse un glaçon sous le t-shirt de la personne en face de toi et remonte-le avec ta bouche.",
    "Lance une musique sensuelle et danse à 20 centimètres de la personne de ton choix sans la toucher.",
    "Fais semblant de dégrafer un bouton imaginaire du haut de la personne à ta droite, très lentement.",
    "Ferme les yeux et laisse la personne de ton choix toucher ton visage pendant 30 secondes.",
    "Décris à voix haute, sans censure, la tenue que tu aimerais voir sur la personne de ton choix.",
    "Masse les épaules de la personne à ta gauche en soufflant dans sa nuque à chaque expiration.",
    "Lèche du sirop sur la clavicule de la personne de ton choix.",
    "Trace le contour des lèvres de la personne en face de toi avec ton doigt, puis effleure-les de tes lèvres.",
    "Fais glisser une plume imaginaire du coude jusqu'à l'épaule de la personne à ta droite.",
    "Porte la personne de ton choix dans tes bras pendant 15 secondes (ou essaie).",
    "Fais un selfie très proche avec la personne à ta droite, vos lèvres à un doigt d'écart.",
    "Mime un strip-tease de 15 secondes sans retirer le moindre vêtement, rien que par la gestuelle.",
    "Chuchote à la personne à ta gauche un secret que tu n'as jamais dit à voix haute.",
    "Laisse la personne de ton choix choisir une zone de ton corps à masser pendant 1 minute.",
    "Fais deviner un fruit en le traçant avec ta langue sur l'avant-bras de la personne en face de toi.",
    "Masse la mâchoire de la personne à ta droite en la regardant intensément.",
    "Enlace la personne de ton choix par-derrière et balance-toi doucement avec elle pendant 30 secondes.",
    "Fais glisser un glaçon de ta bouche à celle de la personne de ton choix sans les mains.",
    "Écris un mot coquin dans le dos de la personne en face de toi avec le bout de ton doigt, elle doit le deviner.",
    "Tiens le visage de la personne à ta droite entre tes mains et rapproche tes lèvres sans l'embrasser.",
    "Fais un massage de la nuque à la personne de ton choix en chuchotant ce que tu aimes chez elle.",
    "Laisse quelqu'un qui accepte poser sa main sur ton cœur pendant 30 secondes.",
    "Fais glisser tes lèvres sur le trajet d'un glaçon qui fond sur la peau de la personne à ta gauche.",
]
action_candidates += CURATED_ACTIONS

# Contractions françaises (au/du/aux/des) + élisions
def fix(t):
    t = t.replace(" à le ", " au ").replace(" à les ", " aux ")
    t = t.replace(" de le ", " du ").replace(" de les ", " des ")
    t = t.replace("jusqu'à le ", "jusqu'au ").replace("jusqu'à les ", "jusqu'aux ")
    t = t.replace("te embrasse", "t'embrasse").replace("te embrassant", "t'embrassant")
    t = t.replace("te effleure", "t'effleure").replace("te effleurant", "t'effleurant")
    return t

# --- Registre courant : traduit les termes techniques / anglicismes ---
COMMON = {
    "body shot": "shot",
    "un lap dance très rapproché": "une danse très collée",
    "un lap dance": "une danse collée",
    "lap dance": "danse collée",
    "strip-tease": "effeuillage",
    "un slow": "une danse lente",
    "de hipbone à hipbone": "d'une hanche à l'autre",
    "un 7 minutes au paradis": "7 minutes en tête à tête",
    "assis à califourchon sur lui/elle": "assis(e) sur ses genoux",
    "Assois-toi à califourchon sur": "Assois-toi sur les genoux de",
    "à califourchon sur": "sur les genoux de",
    "entre les deux omoplates": "en haut du dos, entre les épaules",
    "entre les omoplates": "en haut du dos",
    "des omoplates": "du haut du dos",
    "les omoplates": "le haut du dos",
    "la clavicule": "le haut de la poitrine",
    "clavicule": "haut de la poitrine",
    "sternum": "milieu de la poitrine",
    "trapèzes": "épaules",
    "creux du coude": "pli du coude",
    "cuir chevelu": "crâne",
    "de la colonne vertébrale": "du dos",
    "la colonne vertébrale": "le dos",
    "colonne vertébrale": "dos",
    "ta colonne": "ton dos",
    "sa colonne": "son dos",
    "la colonne": "le dos",
    "les reins": "le bas du dos",
    "aux reins": "au bas du dos",
    "des reins": "du bas du dos",
    "reins": "bas du dos",
    "bas-ventre": "bas du ventre",
    "sexy": "sensuel",
    "fantasy": "fantasme",
}
def common_register(t):
    for k, v in COMMON.items():
        t = t.replace(k, v)
    return fix(t)

# --- 3 variantes pour désigner la personne visée (au lieu de « du sexe opposé ») ---
# A : rien · B : « la personne de ton choix » · C : « {nom} » (nom d'un joueur du sexe opposé)
import re
PERSON_RE = re.compile(
    r"(?:la personne (?:à ta droite|à ta gauche|en face de toi|devant toi|de ton choix|la plus proche de toi|choisie par vote du groupe|la plus audacieuse du groupe|la plus timide du groupe)"
    r"|quelqu'un(?: qui accepte| qui enlève son t-shirt)?"
    r"|une personne"
    r"|chaque personne(?: du groupe)?"
    r"|chaque joueur"
    r"|un joueur"
    r"|ton voisin"
    r"|un inconnu)"
)
def person_variant(t):
    m = PERSON_RE.search(t)
    if not m:
        return t
    phrase = m.group(0)
    if phrase.startswith("chaque"):
        return t                     # « chaque » : on ne remplace pas par un nom unique
    r = random.random()
    if r < 0.34:
        return t                     # variante A : rien
    if r < 0.67:
        return t[:m.start()] + "la personne de ton choix" + t[m.end():]   # variante B
    return t[:m.start()] + "{nom}" + t[m.end():]                          # variante C

def finalize_dare(t):
    return person_variant(common_register(t))
def finalize_truth(t):
    return common_register(t)

action_candidates = [fix(t) for t in action_candidates]

# Dédup + échantillon
def dedup(cands, existing):
    seen = set(existing)
    out = []
    for c in cands:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

new_actions = dedup(action_candidates, existing_texts)
random.shuffle(new_actions)

# ----------------------------------------------------------------------
# 4) Génération des vérités (candidates)
# ----------------------------------------------------------------------
ZQ = [
    "la nuque", "l'oreille", "le cou", "la clavicule", "le bas du dos",
    "l'intérieur du poignet", "la mâchoire", "le ventre", "le creux du coude", "la tempe",
]
SQ = [
    "te souffle dans la nuque",
    "te mordille le lobe de l'oreille",
    "passe le bout de ses doigts le long de ta colonne",
    "te caresse l'intérieur du poignet",
    "t'embrasse dans le creux du coude",
    "te masse les tempes",
    "glisse un glaçon dans ton cou",
    "te tient par la nuque",
    "trace des cercles sur ton ventre",
    "te murmure quelque chose à l'oreille",
    "tire doucement sur tes cheveux",
    "pose sa main sur ta cuisse",
]
AT = [
    "As-tu déjà eu envie d'embrasser quelqu'un au beau milieu d'une phrase banale ?",
    "As-tu déjà senti un frisson parcourir tout ton corps juste parce qu'on t'a effleuré la main ?",
    "As-tu déjà été incapable de te concentrer parce que quelqu'un dans la pièce te regardait ?",
    "As-tu déjà rêvé qu'un inconnu te faisait quelque chose d'inavouable, au point d'y penser au réveil ?",
    "As-tu déjà dû croiser les jambes pour cacher ton trouble pendant un dîner ?",
    "As-tu déjà gardé un suçon plus longtemps que prévu rien que pour t'en souvenir ?",
    "As-tu déjà frôlé volontairement quelqu'un en prétendant que c'était un accident ?",
    "As-tu déjà porté un parfum uniquement parce qu'il plaisait à quelqu'un ?",
    "As-tu déjà envoyé un message que tu as regretté une seconde après, poussé par le désir ?",
    "As-tu déjà laissé quelqu'un te toucher plus longtemps que tu ne l'aurais cru possible ?",
    "As-tu déjà inventé un prétexte pour rester seul(e) avec quelqu'un de ce groupe ?",
    "As-tu déjà senti la tension monter pendant un simple échange de regards avec un inconnu ?",
    "As-tu déjà imaginé la bouche de quelqu'un ici sur ta peau, ne serait-ce qu'une seconde ?",
    "As-tu déjà fait semblant de ne pas remarquer qu'on te draguait, juste pour prolonger le jeu ?",
    "As-tu déjà eu besoin de te mordre la lèvre pour ne pas dire ce que tu pensais à quelqu'un ?",
    "As-tu déjà senti la chaleur d'un corps sans même qu'il te touche ?",
    "As-tu déjà fait un détour dans une pièce uniquement pour frôler quelqu'un ?",
    "As-tu déjà répondu à un message à 2 heures du matin en sachant très bien ce que ça signifiait ?",
    "As-tu déjà laissé un baiser s'éterniser bien plus longtemps que prévu ?",
    "As-tu déjà eu un geste d'affection envers quelqu'un que tu regrettes de ne pas avoir poussé plus loin ?",
    "As-tu déjà ressenti ton cœur s'accélérer parce que quelqu'un s'est assis juste à côté de toi ?",
    "As-tu déjà murmuré quelque chose d'osé à quelqu'un sans même réfléchir ?",
    "As-tu déjà embrassé quelqu'un dans un endroit où tu n'aurais jamais pensé le faire ?",
    "As-tu déjà délibérément gardé la main de quelqu'un dans la tienne un peu trop longtemps ?",
    "As-tu déjà vécu un moment si électrique que tu y repenses encore des années après ?",
    "As-tu déjà répondu « viens » à quelqu'un sans hésiter une seule seconde ?",
    "As-tu déjà eu le souffle coupé parce que quelqu'un te regardait fixement ?",
    "As-tu déjà offert un massage qui s'est terminé bien différemment de ce que tu avais prévu ?",
    "As-tu déjà joué à ce jeu avec quelqu'un dans le seul but de te rapprocher de lui/elle ?",
    "As-tu déjà ressenti la jalousie te pousser à séduire quelqu'un sous les yeux d'un autre ?",
    "As-tu déjà chuchoté à quelqu'un un secret que tu n'aurais jamais osé lui dire en face ?",
    "As-tu déjà fait une promesse un peu folle à quelqu'un juste après l'avoir embrassé ?",
    "As-tu déjà attendu que tout le monde quitte la pièce pour parler à quelqu'un en particulier ?",
    "As-tu déjà été surpris(e) de toi-même en découvrant que tu aimais qu'on te donne des ordres (ou que tu aimais en donner) ?",
    "As-tu déjà écrit puis effacé un message trop honnête, de peur des conséquences ?",
    "As-tu déjà reçu une photo qui t'a fait monter la température immédiatement ?",
    "As-tu déjà fait semblant d'avoir froid pour qu'on se rapproche de toi ?",
    "As-tu déjà provoqué quelqu'un exprès, juste pour voir jusqu'où il ou elle irait ?",
    "As-tu déjà embrassé quelqu'un en pleine rue sans te soucier des regards ?",
    "As-tu déjà laissé un vêtement chez quelqu'un volontairement, comme prétexte pour revenir ?",
]
QC = [
    "Quelle est la chose que tu remarques en premier chez quelqu'un qui te plaît ?",
    "Quelle est la partie de ton corps que tu adorerais qu'on découvre ce soir ?",
    "Quelle est la chose que tu es capable de faire avec tes mains dont tu es le plus fier/fière ?",
    "Quelle est la zone de quelqu'un ici que tu regardes sans arrêt sans le faire exprès ?",
    "Quelle est la chose la plus douce qu'on puisse te faire sans te toucher ?",
    "Quelle est la tenue dans laquelle tu te sens le plus désirable ?",
    "Quelle est la chose que tu aimerais entendre dans la bouche de la personne de ton choix ?",
    "Quelle est la partie de ton corps que tu protèges le plus et pourquoi ?",
    "Quelle est la chose que tu préfères faire avec ta bouche quand tu embrasses ?",
    "Quelle est la caresse la plus simple qui te fait pourtant fondre ?",
    "Quelle est la chose que tu attends de la personne de ton choix sans jamais le lui dire ?",
    "Quelle est la partie du corps de quelqu'un ici sur laquelle tu poserais tes mains si tu osais ?",
    "Quelle est la chose la plus audacieuse que tu as faite pour plaire physiquement ?",
    "Quelle est la phrase qu'on te dit qui te donne le plus envie de rapprochement ?",
    "Quelle est la chose que tu ne laisses voir que quand tu te sens en totale confiance ?",
    "Quelle est la partie de ton corps qui réagit en premier quand tu es attiré(e) ?",
    "Quelle est la chose que tu rêves de faire à deux mais que tu n'as jamais proposée ?",
    "Quelle est la sensation que tu recherches le plus dans un contact prolongé ?",
    "Quelle est la partie de toi que tu aimerais qu'on touche en premier ce soir ?",
    "Quelle est la chose que tu fais pour te donner du courage avant d'aborder quelqu'un ?",
    "Quelle est la limite que tu refuses de franchir, même dans le feu de l'action ?",
    "Quelle est la chose que tu as découverte sur ton corps récemment ?",
    "Quelle est la partie de quelqu'un ici qui pourrait te faire craquer sur-le-champ ?",
    "Quelle est la chose que tu aimes qu'on te fasse sans que tu aies à demander ?",
    "Quelle est la phrase de drague la plus efficace qu'on t'ait dite ?",
    "Quelle est la chose que tu adores offrir à quelqu'un sans rien attendre en retour ?",
    "Quelle est la zone de ton cou que tu préfères qu'on touche ?",
    "Quelle est la chose qui te donne instantanément confiance en toi dans un rapprochement ?",
    "Quelle est la partie de ton corps que tu montres avec le plus de fierté ?",
    "Quelle est la chose que tu aimerais qu'on t'écrive à l'oreille avec le bout du doigt ?",
    "Quelle est la sensation que tu n'as jamais osé réclamer de peur du jugement ?",
    "Quelle est la chose que tu ne peux pas t'empêcher de faire quand quelqu'un te frôle ?",
    "Quelle est la partie du visage de quelqu'un que tu regardes en dernier avant de l'embrasser ?",
    "Quelle est la chose que tu aimerais essayer avec quelqu'un en qui tu as une confiance absolue ?",
    "Quelle est la chanson qui te donne immédiatement envie de te rapprocher de quelqu'un ?",
    "Quelle est la chose la plus romantique ET la plus chaude qu'on t'ait jamais faite ?",
    "Quelle est la partie de toi que tu ne laisses toucher qu'à une personne très spéciale ?",
    "Quelle est la chose que tu aimerais qu'on te fasse à la toute fin de cette soirée ?",
    "Quelle est la question que tu espères que quelqu'un te pose ce soir ?",
    "Quelle est la chose que tu gardes sous silence depuis trop longtemps ?",
]
QE = [
    "Qu'est-ce qui te donne le plus envie de te rapprocher de quelqu'un ?",
    "Qu'est-ce que tu fais pour faire comprendre à quelqu'un qu'il ou elle te plaît ?",
    "Qu'est-ce qui te fait le plus craquer chez la personne de ton choix ici ?",
    "Qu'est-ce qu'un simple regard peut te faire dire que tu n'aurais jamais dit autrement ?",
    "Qu'est-ce que tu adores qu'on te fasse dans le dos, sans prévenir ?",
    "Qu'est-ce qui te rend le plus vulnérable dans les bras de quelqu'un ?",
    "Qu'est-ce que tu remarques en premier chez quelqu'un qui t'attire physiquement ?",
    "Qu'est-ce qui te fait fondre plus vite : les mots ou les gestes ?",
    "Qu'est-ce que tu fais avec tes yeux quand tu veux séduire sans parler ?",
    "Qu'est-ce que tu attends le plus d'un massage : la détente ou autre chose ?",
    "Qu'est-ce qui t'a déjà fait rougir alors que personne ne t'avait touché ?",
    "Qu'est-ce que tu aimerais qu'on t'offre comme attention ce soir ?",
    "Qu'est-ce qui te fait le plus d'effet : un murmure, un effleurement ou un regard ?",
    "Qu'est-ce que tu penses que les autres voient en toi sans que tu le saches ?",
    "Qu'est-ce que tu fais pour cacher ton trouble quand quelqu'un te plaît ?",
    "Qu'est-ce qui t'empêche parfois de faire le premier pas ?",
    "Qu'est-ce que tu aimerais qu'on te dise pendant que tu embrasses ?",
    "Qu'est-ce qui te donne envie d'être un peu plus audacieux/audacieuse ce soir ?",
    "Qu'est-ce que tu recherches dans un contact visuel prolongé ?",
    "Qu'est-ce que tu voudrais que quelqu'un fasse de ses mains en ce moment ?",
    "Qu'est-ce qui te rassure le plus chez quelqu'un avec qui tu te rapproches ?",
    "Qu'est-ce que tu as appris sur toi grâce à ce genre de jeux ?",
    "Qu'est-ce qui te donne des frissons rien qu'en y pensant ?",
    "Qu'est-ce que tu oserais faire ce soir que tu n'as jamais osé ?",
    "Qu'est-ce que tu aimes chez toi que peu de gens remarquent ?",
    "Qu'est-ce que tu fais de ta voix quand tu veux être irrésistible ?",
    "Qu'est-ce qui te fait rester : le frisson du jeu ou la personne en face ?",
    "Qu'est-ce que tu aimerais qu'on te demande à voix basse ?",
    "Qu'est-ce qui rend une accolade différente de toutes les autres ?",
    "Qu'est-ce que tu attends de la personne qui osera te choisir ce soir ?",
]
TD = [
    "Décris le bruit que tu aimerais entendre de la part de la personne de ton choix.",
    "Décris la façon dont tu aimerais être approché(e) par quelqu'un qui te plaît.",
    "Décris le moment précis où tu sais qu'un simple jeu va plus loin.",
    "Décris ce que tu ressens quand quelqu'un te frôle « par accident ».",
    "Décris l'endroit où tu rêves qu'on t'embrasse un jour.",
    "Décris la caresse idéale que tu n'as jamais reçue.",
    "Décris comment tu sais, sans un mot, que quelqu'un te désire.",
    "Décris ce que tu aimerais qu'il se passe dans les dix prochaines minutes.",
    "Décris la façon dont tu te sens quand tu es le centre de l'attention de quelqu'un.",
    "Décris le premier geste que tu ferais à la personne de ton choix si tout était permis.",
    "Décris la sensation d'un baiser qu'on attend depuis trop longtemps.",
    "Décris ce que tu vois chez quelqu'un ici qui te donne envie de rester.",
    "Décris l'atmosphère parfaite pour que tu te laisses aller.",
    "Décris ce que tes mains feraient d'elles-mêmes si personne ne regardait.",
    "Décris le regard que tu poserais sur la personne de ton choix avant de l'embrasser.",
    "Décris ce que tu voudrais qu'on te fasse quand tu fermes les yeux.",
    "Décris la dernière fois où ton corps a réagi avant ton cerveau.",
    "Décris ce qui te fait t'attarder chez quelqu'un alors que tu devrais partir.",
    "Décris le moment où un simple contact devient une promesse.",
    "Décris ce que tu attends d'une soirée comme celle-ci, honnêtement.",
    "Décris la distance exacte à laquelle tu aimerais que la personne de ton choix se tienne.",
    "Décris ce que tu ferais si la personne en face de toi faisait le premier pas.",
    "Décris la musique que tu mettrais pour un rapprochement parfait.",
    "Décris ce que tu aimerais découvrir chez quelqu'un ici, sans censure.",
    "Décris la façon dont tu veux qu'on te dise qu'on a envie de toi.",
    "Décris le souvenir le plus chaud que tu associes à une simple main posée sur toi.",
    "Décris ce que tu ressens quand une conversation devient chuchotement.",
    "Décris l'endroit de la pièce où tu aimerais te retrouver seul(e) avec quelqu'un.",
    "Décris ce que tu attendais de ce jeu en arrivant, et ce que tu espères maintenant.",
    "Décris la promesse que tu ferais à la personne de ton choix si elle était prête à tout entendre.",
]
SI = [
    "Si tu pouvais demander un massage à quelqu'un ici, quelle zone choisirais-tu ?",
    "Si tu devais embrasser quelqu'un dans cette pièce les yeux fermés, vers qui irais-tu ?",
    "Si tu pouvais passer une heure seul(e) avec quelqu'un ici, qui choisirais-tu et pourquoi ?",
    "Si tu pouvais demander une seule chose à la personne de ton choix ce soir, ce serait quoi ?",
    "Si tu devais chuchoter un secret coquin à quelqu'un ici, que dirais-tu ?",
    "Si tu pouvais échanger une partie de ton corps avec celle de quelqu'un, laquelle ?",
    "Si tu pouvais réécrire ton premier baiser, que changerais-tu ?",
    "Si tu devais décrire la personne de ton choix en trois mots interdits en public, lesquels ?",
    "Si tu pouvais être touché(e) par quelqu'un ici à un seul endroit, lequel ?",
    "Si tu pouvais danser avec quelqu'un ici sans aucun témoin, qui choisirais-tu ?",
    "Si tu devais envoyer un message osé à quelqu'un ici, à qui et quoi ?",
    "Si tu pouvais demander à quelqu'un de t'embrasser n'importe où, où serait-ce ?",
    "Si tu pouvais exaucer un désir de la personne de ton choix, lequel espères-tu ?",
    "Si tu devais partager un lit avec quelqu'un ici sans rien faire d'autre, qui ?",
    "Si tu pouvais lire dans les pensées de quelqu'un ici, qui choisirais-tu ?",
    "Si tu devais laisser un mot sur la peau de quelqu'un ici, qu'écrirais-tu ?",
    "Si tu pouvais réessayer un moment raté avec quelqu'un, lequel ?",
    "Si tu pouvais donner un surnom coquin à la personne de ton choix, lequel ?",
    "Si tu devais choisir un joueur pour te faire un massage les yeux fermés, qui ?",
    "Si tu pouvais emmener quelqu'un ici en week-end, qui et où ?",
    "Si tu pouvais demander à quelqu'un de te souffler une phrase dans le cou, laquelle ?",
    "Si tu pouvais recevoir un baiser de quelqu'un ici sans conséquence, de qui ?",
    "Si tu devais décrire l'endroit où tu te sens le plus vulnérable, lequel ?",
    "Si tu pouvais choisir la prochaine carte de quelqu'un ici, que choisirais-tu ?",
    "Si tu pouvais offrir un dernier verre à quelqu'un ici, à qui et pourquoi ?",
    "Si tu pouvais demander à quelqu'un de te tenir la main toute la soirée, qui ?",
    "Si tu pouvais t'asseoir sur les genoux de quelqu'un ici, qui choisirais-tu ?",
    "Si tu devais avouer ton plus gros fantasme, à qui le dirais-tu ?",
    "Si tu pouvais recevoir un compliment par minute de la part de quelqu'un ici, de qui ?",
    "Si tu pouvais choisir une musique pour danser collé(e)-serré(e) avec quelqu'un, laquelle ?",
    "Si tu devais donner un massage à quelqu'un ici, qui et où ?",
    "Si tu pouvais faire fondre un glaçon sur la peau de quelqu'un ici, sur qui ?",
    "Si tu pouvais demander à quelqu'un de te murmurer ce que tu veux, quoi ?",
    "Si tu pouvais être la personne que tout le monde veut choisir ce soir, le serais-tu ?",
    "Si tu devais partager un baiser en trois secondes avec quelqu'un ici, qui ?",
    "Si tu pouvais recevoir une lettre coquine, de qui l'aimerais-tu ?",
    "Si tu pouvais t'endormir contre quelqu'un ici sans aucune gêne, qui ?",
    "Si tu pouvais demander une faveur sensuelle à la personne de ton choix, laquelle ?",
    "Si tu devais choisir quelqu'un ici pour un slow, qui choisirais-tu ?",
    "Si tu pouvais connaître le désir secret de quelqu'un ici, de qui ?",
    "Si tu pouvais offrir un massage d'une heure à quelqu'un ici, à qui ?",
    "Si tu devais laisser quelqu'un ici choisir ta prochaine action, qui ?",
    "Si tu pouvais retirer un vêtement à quelqu'un ici (avec son accord), lequel ?",
    "Si tu pouvais être le personnage principal du fantasme de quelqu'un ici, qui aimerais-tu que ce soit ?",
    "Si tu devais embrasser la main de quelqu'un ici en public, de qui ?",
    "Si tu pouvais demander à quelqu'un de te border comme un rituel, qui ?",
    "Si tu pouvais revivre la première fois où quelqu'un t'a vraiment désiré(e), avec qui ?",
    "Si tu pouvais demander à quelqu'un ici de rester après la fin du jeu, qui ?",
    "Si tu devais avouer une envie que tu n'as jamais dite, laquelle ?",
    "Si tu pouvais poser une seule question osée à la personne de ton choix, laquelle ?",
]

QR = [
    "Qui dans cette pièce te fait le plus d'effet, et qu'est-ce qui te plaît chez lui/elle ?",
    "Quel est le compliment le plus osé qu'on puisse te faire sans te gêner ?",
    "Quel joueur ici mériterait selon toi le titre de « plus désirable » et pourquoi ?",
    "Quelle image de toi aimerais-tu laisser dans la tête de la personne de ton choix ?",
    "Quelle est ta technique infaillible pour séduire sans parler ?",
    "Quel est le geste anodin qui te trouble le plus chez quelqu'un ?",
    "Quel est le fantasme que tu aimerais réaliser avant la fin de l'année ?",
    "Quelle tenue chez quelqu'un te fait immédiatement tourner la tête ?",
    "Quel est le moment de la journée où tu te sens le plus désirable ?",
    "Quelle est la première chose que tu remarques chez quelqu'un en le voyant arriver ?",
    "Quel est le film ou la scène qui t'a donné envie de jouer à ce genre de jeu ?",
    "Quelle est ta limite absolue, celle que personne ne doit franchir ce soir ?",
    "Quel est le mot ou la phrase qui te fait instantanément rougir ?",
    "Quelle partie de ta personnalité devient irrésistible quand tu es en confiance ?",
    "Quel secret inoffensif sur toi ferait le plus rire ce groupe ?",
    "Quelle est la chose que tu fais machinalement quand tu dragues ?",
    "Quel est ton pire tic quand quelqu'un te plaît ?",
    "Quel joueur ici a, selon toi, le regard le plus intense ?",
    "Quelle est la question que tu n'oses jamais poser de peur de la réponse ?",
    "Quel est le souvenir qui te fait encore frissonner quand tu y penses ?",
    "Qui embrasse le mieux selon les rumeurs, et crois-tu que ce soit vrai ?",
    "Quelle est la musique sur laquelle tu ne peux pas t'empêcher de danser sensuellement ?",
    "Quel est le parfum ou l'odeur qui te rend complètement faible ?",
    "Quelle est ta plus grande qualité en matière de séduction, selon toi ?",
    "Quel défaut trouves-tu au contraire incroyablement charmant chez les autres ?",
    "Qui est la personne de ce groupe que tu choisirais comme partenaire de danse et pourquoi ?",
    "Quelle est la chose la plus coquine que tu aies dite par accident ?",
    "Quel est le rendez-vous parfait selon toi, de A à Z ?",
    "Quelle est la première chose que tu ferais après cette soirée si tout était permis ?",
    "Quel est ton signe de drague le plus discret ?",
    "Qui te connaît le mieux ici, et que sait-il/elle de toi ?",
    "Quelle est ta réaction si la personne de ton choix te fixe sans un mot ?",
    "Quel est le plus beau compliment qu'on t'ait fait sur ton corps ?",
    "Quelle est la partie de toi que tu trouves la plus sous-estimée ?",
    "Quel est ton souvenir de vacances le plus chaud ?",
    "Qui dans ce groupe te ferait le plus rougir avec un simple regard ?",
    "Quelle est la règle que tu aimerais inventer pour ce jeu ce soir ?",
    "Quel est le défi que tu espères ne jamais recevoir ?",
    "Quelle est la chose que tu as toujours voulu essayer sans jamais l'avouer ?",
    "Quel est le type de regard qui te fait le plus d'effet ?",
    "Qui choisirais-tu pour t'aider à retirer un vêtement, si le jeu l'exigeait ?",
    "Quelle est la tenue que tu rêves de voir sur la personne de ton choix ?",
    "Quel est le plus gros mensonge que tu aies dit pour impressionner quelqu'un ?",
    "Quelle est ta façon préférée de briser la glace avec quelqu'un qui te plaît ?",
    "Quel est l'accessoire ou le vêtement qui te donne un maximum de confiance ?",
    "Qui ici dégagerait le plus de charme selon toi, et pourquoi ?",
    "Quelle est la chose la plus spontanée que tu aies faite par désir ?",
    "Quel est ton point faible : le regard, la voix ou les mains ?",
    "Quelle est la scène que tu aimerais rejouer avec quelqu'un de ce groupe ?",
    "Quel est le moment où tu t'es senti(e) le plus désiré(e) de ta vie ?",
    "Qui dans cette pièce est le plus difficile à décoder, selon toi ?",
    "Quelle est la chose que tu aimerais qu'on t'avoue ce soir ?",
    "Quel est ton plus beau souvenir lié à un baiser ?",
    "Quelle est ta définition du charme, en trois mots ?",
    "Quel est le compliment que tu gardes précieusement en mémoire ?",
    "Qui choisirais-tu pour t'écrire une lettre d'amour torride ?",
    "Quelle est la partie de ton corps que tu aimerais qu'on redécouvre ?",
    "Quel est le moment idéal pour un premier baiser, selon toi ?",
    "Quelle est la chose que tu trouves sexy chez toi sans l'avouer ?",
    "Qui dans ce groupe a le sourire le plus envoûtant ?",
    "Quelle est la plus grosse bêtise que tu aies faite pour quelqu'un qui te plaisait ?",
    "Quel est ton langage de l'amour préféré : les mots, les gestes ou les attentions ?",
    "Quelle est la phrase que tu aimerais entendre juste avant qu'on t'embrasse ?",
    "Qui ici serait le plus surprenant en tête-à-tête, selon toi ?",
    "Quelle est la chose que tu observes en premier chez quelqu'un qui danse ?",
    "Quel est le rêve le plus osé que tu aies fait à propos de quelqu'un d'ici ?",
    "Quelle est la qualité que tu recherches avant de laisser quelqu'un s'approcher ?",
    "Qui choisirais-tu pour un massage de trente minutes, sans hésiter ?",
    "Quelle est la chose que tu n'as jamais osé demander à personne ?",
    "Quel est le baiser dont tu te souviendras toute ta vie ?",
]

truth_candidates = []
for z in ZQ:
    truth_candidates.append(f"Quelle est la chose que tu préfères qu'on te fasse à {z} ?")
for s in SQ:
    truth_candidates.append(f"Décris ce que tu ressens quand quelqu'un {s}.")
for p in P:
    for z in ZKISS:
        truth_candidates.append(f"Quelle serait ta réaction si {p} t'embrassait {z} ?")
    for z in ZMASS:
        truth_candidates.append(f"Décris l'effet que te ferait un massage de {z} par {p}.")
    for z in ZSOUFFLE:
        truth_candidates.append(f"Comment réagirais-tu si {p} te soufflait dans {z} sans prévenir ?")
truth_candidates += AT + QC + QE + TD + SI + QR
truth_candidates = [fix(t) for t in truth_candidates]

new_truths = dedup(truth_candidates, existing_texts)
random.shuffle(new_truths)

# ----------------------------------------------------------------------
# 4bis) 2000 cartes HARDCORE (1160 actions + 840 vérités) — niveau brulant
# ----------------------------------------------------------------------
HZ = [
    "le cou", "la nuque", "la clavicule", "les seins", "le torse", "le ventre",
    "le nombril", "les hanches", "le bas du dos", "les fesses",
    "l'intérieur des cuisses", "les cuisses", "le creux du genou", "la cheville",
    "le lobe de l'oreille", "l'intérieur du poignet",
]
HSZ = ["les fesses", "l'arrière des cuisses"]
HD = ["15 secondes", "30 secondes", "1 minute", "2 minutes", "3 minutes"]

hard_action_candidates = []
for p in P:
    for z in HZ:
        for d in HD:
            hard_action_candidates.append(f"Attache les poignets de {p} dans le dos avec une ceinture, puis caresse {z} de haut en bas pendant {d}.")
            hard_action_candidates.append(f"Tire doucement les cheveux de {p} tout en lui embrassant {z} pendant {d}.")
            hard_action_candidates.append(f"Glisse ta main sous le vêtement de {p} jusqu'à {z}, et arrête-toi juste avant, pendant {d}.")
            hard_action_candidates.append(f"Chuchote à {p} le scénario le plus hard que tu oserais vivre, en lui mordillant {z} pendant {d}.")
            hard_action_candidates.append(f"Fais un body shot sur {z} de {p} : sel, shot, citron, et récupère le tout avec ta langue pendant {d}.")
            hard_action_candidates.append(f"Embrasse {z} de {p} en y laissant un suçon bien visible pendant {d}.")
    for z in HZ:
        hard_action_candidates.append(f"Bande les yeux de {p}, fais-lui goûter trois aliments, puis lèche {z} pour le dessert.")
        hard_action_candidates.append(f"Trace un mot coquin avec ta langue sur {z} de {p}, qui doit le deviner sans regarder.")
    for z in HSZ:
        hard_action_candidates.append(f"Donne trois claques légères sur {z} de {p}, avec son accord, en comptant à voix haute.")
    hard_action_candidates.append(f"Assois-toi à califourchon sur {p} et fais-lui un lap dance de 2 minutes sans le toucher avec les mains.")
    hard_action_candidates.append(f"Enlève un vêtement de {p} avec les dents uniquement.")
    hard_action_candidates.append(f"Fais porter à {p} un bandeau sur les yeux pendant deux tours, puis guide ses mains sur ton corps.")

hard_action_candidates += [
    "Fais un strip-tease jusqu'aux sous-vêtements devant tout le groupe, en musique.",
    "Laisse la personne la plus proche de toi te faire un suçon où elle veut, tant qu'il est caché.",
    "Refais ton lit de façon suggestive, à quatre pattes, pendant que le groupe te regarde.",
    "Échange ton haut avec quelqu'un qui accepte, dos à dos, sans regarder.",
    "Garde les mains attachées derrière le dos pendant deux tours.",
    "Fais deviner une position coquine en la mimant au sol, sans un mot.",
    "Récite l'alphabet en embrassant une zone différente de la personne de ton choix à chaque lettre.",
    "Fais un câlin collé-serré de 2 minutes à la personne de ton choix, en respirant fort dans son cou.",
    "Laisse la personne de ton choix t'écrire un mot au feutre quelque part sous tes vêtements.",
    "Fais un massage intégral des pieds à la tête à la personne de ton choix, pendant 5 minutes.",
    "Mime la scène de ton fantasme préféré avec la personne de ton choix, sans la toucher.",
    "Reste assis sur les genoux de quelqu'un qui accepte pendant tout le tour suivant.",
    "Laisse quelqu'un qui accepte t'attacher les chevilles avec une écharpe pendant un tour.",
    "Fais un exercice de respiration très bruyant en gardant le contact visuel avec la personne en face de toi.",
    "Chuchote à l'oreille de la personne à ta gauche trois choses que tu aimerais qu'on te fasse.",
    "Fais un massage du crâne à la personne à ta droite en lui tirant très doucement les cheveux.",
    "Laisse la personne de ton choix poser une main n'importe où sur toi pendant 20 secondes, au-dessus des vêtements.",
    "Fais un effeuillage symbolique : retire trois accessoires lentement, avec le regard fixe.",
    "Bois un shot sur le nombril de quelqu'un qui accepte.",
    "Fais goûter un glaçon à la personne de ton choix uniquement avec ta bouche.",
    "Raconte à voix haute, en détail, ce que tu ferais si tu gagnais une nuit entière avec la personne de ton choix.",
    "Fais tenir une position de gaine pendant que quelqu'un qui accepte te fait un massage des épaules.",
    "Demande à la personne de ton choix de t'attacher un bandeau, puis laisse-la te faire deviner un objet.",
    "Imite le bruit le plus suggestif possible pendant 10 secondes, sans rire.",
]
hard_action_candidates = [fix(t) for t in hard_action_candidates]

hard_truth_candidates = []
for p in P:
    for z in HZ:
        hard_truth_candidates.append(f"Quelle serait ta réaction si {p} te léchait {z} sans prévenir ?")
        hard_truth_candidates.append(f"Décris exactement comment {p} devrait te toucher {z} pour te faire perdre la tête.")
        hard_truth_candidates.append(f"Préférerais-tu que {p} te morde, te lèche ou te caresse {z} ?")
        hard_truth_candidates.append(f"Quel mot aimerais-tu que {p} t'écrive avec sa langue sur {z} ?")
        for d in HD:
            hard_truth_candidates.append(f"Décris ce que tu ressentirais si {p} te maintenait contre le mur en te léchant {z} pendant {d}.")
            hard_truth_candidates.append(f"Raconte un souvenir, réel ou rêvé, où {p} t'embrassait {z} pendant {d}.")
    hard_truth_candidates.append(f"Si tu pouvais attacher {p} pendant une heure, que ferais-tu de lui/elle ?")
    hard_truth_candidates.append(f"Quelle fessée mériterais-tu de la part de {p}, et avec quoi ?")
    hard_truth_candidates.append(f"Si {p} te bandait les yeux, qu'espérerais-tu qu'il/elle te fasse ensuite ?")
    hard_truth_candidates.append(f"Quel est le scénario le plus hard que tu imaginerais avec {p} ?")

hard_truth_candidates += [
    "Quel est le fantasme le plus extrême que tu n'as jamais osé dire à voix haute ?",
    "Quelle est la chose la plus hard que tu aies faite avec un(e) partenaire ?",
    "As-tu déjà utilisé des menottes, un bandeau ou une ceinture ? Raconte.",
    "Quelle est ta position préférée, et pourquoi ?",
    "As-tu déjà eu une relation purement physique ? Comment c'était ?",
    "Quel est le compliment le plus cru qu'on puisse te faire au lit ?",
    "As-tu déjà fait l'amour dans un endroit risqué ? Où ?",
    "Quelle est la partie du corps de quelqu'un ici que tu aimerais le plus mordiller ?",
    "Quel mot prononcé à voix basse te fait le plus d'effet ?",
    "As-tu déjà laissé une marque (suçon, griffure) ou reçu une marque ? Où ?",
    "Quelle est ta limite absolue au lit, celle que tu ne franchiras jamais ?",
    "As-tu déjà dominé quelqu'un, ou été dominé(e) ? Raconte.",
    "Quel est ton sextoy ou accessoire préféré, si tu en as un ?",
    "Quel est le bruit que tu fais quand tu es vraiment excité(e) ?",
    "As-tu déjà filmé ou pris en photo un moment intime ?",
    "Quelle partie de ton corps réagit la première quand tu es excité(e) ?",
    "Quel est le lieu le plus excitant où tu rêverais de le faire ?",
    "As-tu déjà eu envie de quelqu'un d'ici pendant le jeu ?",
    "Quelle est la chose que tu ne supportes pas au lit ?",
    "Quel est le plus long moment sans contact physique que tu aies tenu ?",
    "As-tu déjà été attrapé(e) en pleine action ? Raconte.",
    "Quel est le scénario de jeu de rôle qui t'excite le plus ?",
    "Quelle est la partie la plus sensible de ton corps, celle que tu caches ?",
    "As-tu déjà fait le premier pas de façon très directe ? Comment ?",
    "Quel est le souvenir le plus hard de ta vie ?",
    "Qu'est-ce qui te fait le plus craquer : la domination ou la douceur ?",
    "As-tu déjà dit un mot interdit pendant l'acte ? Lequel ?",
    "Quel est le fantasme que tu aimerais réaliser avec quelqu'un d'ici ?",
    "Quelle est la chose que tu aimerais qu'on te fasse sans que tu aies à le demander ?",
    "As-tu déjà eu un coup de foudre purement physique ?",
]
hard_truth_candidates = [fix(t) for t in hard_truth_candidates]

used = set(existing_texts) | set(new_actions) | set(new_truths)
hard_actions = dedup(hard_action_candidates, used)
random.shuffle(hard_actions)

used |= set(hard_actions)
hard_truths = dedup(hard_truth_candidates, used)
random.shuffle(hard_truths)

# ----------------------------------------------------------------------
# 4ter) 6500 cartes HARDCORE++ (2972 actions + 3528 vérités) — niveau brulant
# ----------------------------------------------------------------------
HZ2 = [
    "le cou", "la nuque", "la clavicule", "la poitrine", "le torse", "le ventre",
    "le nombril", "les hanches", "le bas du dos", "les reins", "les fesses",
    "l'intérieur des cuisses", "les cuisses", "le creux du genou", "la cheville",
    "le lobe de l'oreille", "l'intérieur du poignet", "la mâchoire", "l'oreille",
    "les omoplates", "la colonne vertébrale", "le sternum", "les côtes", "le bas-ventre",
]
P2 = P + ["la personne la plus audacieuse du groupe", "la personne la plus timide du groupe"]
V_DIR = [
    "Caresse", "Masse", "Embrasse", "Lèche lentement", "Mordille",
    "Effleure du bout des doigts", "Touche", "Presse fermement", "Suce",
    "Pince doucement", "Griffe légèrement", "Gratte du bout des ongles",
]
DUR2 = ["pendant 10 secondes", "pendant 15 secondes", "pendant 30 secondes",
        "pendant 1 minute", "pendant 2 minutes", "pendant 3 minutes", "pendant 5 minutes"]
MAN2 = ["en gardant le contact visuel", "sans utiliser les mains", "les yeux fermés",
        "en chuchotant quelque chose d'osé", "en respirant fort dans son cou",
        "en laissant une marque visible", "très lentement", "en rythme avec la musique",
        "en te collant à lui/elle", "avec un glaçon dans la bouche"]
V_SUR = ["Fais glisser un glaçon sur", "Fais glisser ta langue sur", "Fais glisser tes ongles sur",
         "Trace des cercles avec ta langue sur", "Fais couler du miel sur", "Passe une plume sur",
         "Souffle doucement sur", "Dépose une traînée de baisers sur", "Écris un mot coquin avec ta langue sur"]

hx_action_candidates = []
for v in V_DIR:
    for z in HZ2:
        for p in P2:
            for d in DUR2:
                for m in MAN2:
                    hx_action_candidates.append(f"{v} {z} de {p} {d}, {m}.")
for v in V_SUR:
    for z in HZ2:
        for p in P2:
            for d in DUR2:
                hx_action_candidates.append(f"{v} {z} de {p} {d}.")
for p in P2:
    for n in ["trois", "cinq", "dix"]:
        hx_action_candidates.append(f"Donne {n} claques sur les fesses de {p}, avec son accord, en comptant à voix haute.")
        hx_action_candidates.append(f"Donne {n} claques sur l'arrière des cuisses de {p}, avec son accord.")
    for obj in ["une ceinture", "une écharpe", "un foulard", "des lacets"]:
        hx_action_candidates.append(f"Attache les poignets de {p} dans le dos avec {obj}, puis embrasse sa nuque pendant 1 minute.")
        hx_action_candidates.append(f"Bande les yeux de {p} avec {obj}, puis fais-lui deviner un objet avec ses lèvres.")
        hx_action_candidates.append(f"Attache les chevilles de {p} avec {obj}, puis caresse l'intérieur de ses cuisses pendant 1 minute.")
    for d in DUR2:
        hx_action_candidates.append(f"Fais un lap dance à {p} {d}, sans jamais le toucher avec les mains.")
        hx_action_candidates.append(f"Assois-toi à califourchon sur {p} {d}, en bougeant au rythme de la musique.")
        hx_action_candidates.append(f"Garde {p} contre le mur {d}, en lui tenant les poignets au-dessus de la tête.")
    hx_action_candidates.append(f"Ordonne à {p} de s'agenouiller devant toi pendant 1 minute, sans dire un mot.")
    hx_action_candidates.append(f"Fais un body shot sur le nombril de {p} : sel, shot, citron, le tout récupéré avec ta bouche.")
    hx_action_candidates.append(f"Tire doucement les cheveux de {p} vers l'arrière tout en lui mordillant le cou.")

hx_action_candidates += [
    "Joue au docteur avec la personne de ton choix pendant 2 minutes : examen très rapproché, sans les mains.",
    "Fais semblant de dessiner le portrait de la personne en face de toi en détaillant son corps à voix haute.",
    "Laisse la personne de ton choix t'embrasser le cou pendant que tu dois garder les yeux ouverts.",
    "Imite une scène de film coquine avec la personne à ta droite, en y mettant le ton.",
    "Demande à la personne à ta gauche de poser une main sur ton cou pendant 30 secondes.",
    "Fais un twerk de 20 secondes devant la personne de ton choix.",
    "Glisse ta main dans la poche arrière de la personne de ton choix pendant 15 secondes.",
    "Fais boire la personne en face de toi à la régalade, en te tenant très près de sa bouche.",
    "Suspends ton visage à quelques centimètres de la personne de ton choix pendant 30 secondes, sans l'embrasser.",
    "Fais un slow collé-serré avec la personne de ton choix sur une musique de ton choix.",
    "Trace le contour du visage de la personne à ta droite avec le bout de ta langue.",
    "Mets du rouge à lèvres et laisse une marque sur le cou de la personne de ton choix.",
    "Masse les épaules de la personne en face de toi en t'asseyant sur elle.",
    "Porte la personne de ton choix dans tes bras pendant 20 secondes, puis dépose-la doucement.",
    "Reste immobile pendant que la personne de ton choix promène ses mains à deux centimètres de ton corps, sans te toucher.",
    "Écris un mot coquin avec ta langue sur le dos de la personne à ta gauche, qui doit le deviner.",
    "Chante une chanson sensuelle en regardant la personne de ton choix dans les yeux.",
    "Joue à ne pas reculer : vos lèvres se rapprochent, personne ne doit rompre le contact des yeux.",
    "Laisse la personne en face de toi t'attacher les mains devant et te faire danser pendant 30 secondes.",
    "Rejoue ton rêve le plus osé en ombre chinoise avec tes mains, devant le groupe.",
    "Masse la mâchoire de la personne de ton choix en chuchotant son prénom.",
    "Échange ton souffle avec la personne à ta droite, front contre front, pendant 30 secondes.",
    "Fais un défilé de mode sensuel avec trois accessoires du groupe, en musique.",
    "Tiens la personne de ton choix par les hanches et guide-la dans une danse très lente.",
    "Reste à quatre pattes pendant que la personne de ton choix te tapote le dos du bout des doigts pendant 30 secondes.",
    "Fais un câlin par-derrière à la personne à ta gauche en la berçant pendant 1 minute.",
    "Demande à la personne de ton choix de te servir un verre, puis bois-le dans sa main.",
    "Fais une déclaration très osée à la personne en face de toi, à genoux.",
    "Laisse la personne la plus audacieuse du groupe te faire un body shot où elle veut.",
    "Fais un massage de la nuque à la personne la plus timide du groupe en la rassurant à voix basse.",
]
hx_action_candidates = [fix(t) for t in hx_action_candidates]

TV2 = ["touche", "caresse", "embrasse", "lèche", "mordille", "masse", "suce", "effleure", "pince doucement", "griffe"]
GER2 = {"touche": "touchant", "caresse": "caressant", "embrasse": "embrassant", "lèche": "léchant",
        "mordille": "mordillant", "masse": "massant", "suce": "suçant", "effleure": "effleurant",
        "pince doucement": "pinçant doucement", "griffe": "griffant"}
hx_truth_candidates = []
for p in P2:
    for z in HZ2:
        for v in TV2:
            for d in ["10 secondes", "15 secondes", "30 secondes", "1 minute", "2 minutes", "3 minutes", "5 minutes"]:
                hx_truth_candidates.append(f"Décris ce que tu ressentirais si {p} te {v} {z} pendant {d}.")
                hx_truth_candidates.append(f"Quelle serait ta réaction si {p} te {v} {z} sans prévenir ?")
                hx_truth_candidates.append(f"Préférerais-tu que {p} te {v} {z} pendant {d}, ou l'inverse ?")
                hx_truth_candidates.append(f"Raconte, en détail, un scénario où {p} te {v} {z} pendant {d}.")
                hx_truth_candidates.append(f"Quel bruit ferais-tu si {p} te {v} {z} pendant {d} ?")
                hx_truth_candidates.append(f"Décris la sensation que te procurerait {p} en te {GER2[v]} {z} pendant {d}.")

hx_truth_candidates += [
    "Quel est le geste que la personne de ton choix pourrait faire pour te faire supplier ?",
    "As-tu déjà été avec quelqu'un qui aimait dominer ? Raconte.",
    "Quelle est la chose la plus déplacée qu'on t'ait dite pendant un moment intime ?",
    "Quel accessoire aimerais-tu que la personne de ton choix utilise sur toi ?",
    "As-tu déjà envoyé un message que tu regrettes ? À qui et pourquoi ?",
    "Quelle est la tenue la plus osée que tu porterais pour quelqu'un qui te plaît ?",
    "Quelle est la partie du corps de la personne de ton choix que tu aimerais explorer le plus longtemps ?",
    "As-tu déjà rêvé d'être attaché(e) ou d'attacher quelqu'un ? Décris.",
    "Quel est ton rituel pour te mettre dans l'ambiance ?",
    "As-tu déjà été attiré(e) par la voix de quelqu'un au point d'y penser le soir ?",
    "Quel est le plus long baiser de ta vie ? Raconte le contexte.",
    "Quelle est la question la plus gênante qu'on t'ait posée sur ta vie intime ?",
    "As-tu déjà eu un jeu de rôle préféré au lit ? Lequel ?",
    "Quel est le compliment le plus pervers qu'on t'ait fait ?",
    "As-tu déjà jalousé quelqu'un pour son corps ? Qui et pourquoi ?",
    "Quelle est la chose que tu fais exprès pour attirer l'attention de quelqu'un qui te plaît ?",
    "As-tu déjà été surpris(e) par ton propre désir pour quelqu'un d'inattendu ?",
    "Quelle est ta définition d'une soirée parfaitement réussie, sans tabou ?",
    "As-tu déjà ressenti un désir interdit pour quelqu'un d'ici ?",
    "Quel est le scénario le plus fou que tu accepterais de vivre ce soir ?",
    "As-tu déjà flirté avec deux personnes en même temps ? Comment ça s'est terminé ?",
    "Quelle est la partie de ton corps que tu aimerais qu'on découvre en premier ?",
    "As-tu déjà dit je t'aime sans le penser, ou pensé je t'aime sans le dire ?",
    "Quel est le mensonge le plus sexy que tu aies raconté ?",
    "Quelle est la chose que tu n'as jamais osé demander, de peur qu'on te juge ?",
    "As-tu déjà été intimidé(e) par le désir de quelqu'un ?",
    "Quel est ton souvenir le plus chaud de cette année ?",
    "As-tu déjà eu envie de tout plaquer pour suivre quelqu'un ?",
    "Quelle est la phrase qui te fait le plus fondre au lit ?",
    "As-tu déjà partagé un secret avec quelqu'un juste après un moment intime ?",
]
hx_truth_candidates = [fix(t) for t in hx_truth_candidates]

used |= set(hard_truths)
hx_actions = dedup(hx_action_candidates, used)
random.shuffle(hx_actions)

used |= set(hx_actions)
hx_truths = dedup(hx_truth_candidates, used)
random.shuffle(hx_truths)

# ----------------------------------------------------------------------
# 5) Assemblage final : 5000 actions + 5000 vérités (variantes + registre courant)
# ----------------------------------------------------------------------
def _uniq(lst):
    seen = set(); out = []
    for x in lst:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

# Originaux (finalisés, dédupliqués, conservés en tête)
orig_dares  = _uniq([finalize_dare(d["text"])  for d in src if TYPE[d["type"]] == "dare"])
orig_truths = _uniq([finalize_truth(d["text"]) for d in src if TYPE[d["type"]] == "truth"])

# Pools générés (finalisés puis dédupliqués contre les originaux)
seen = set(orig_dares) | set(orig_truths)
gen_dares  = dedup([finalize_dare(t)  for t in new_actions + hard_actions + hx_actions], seen)
seen |= set(gen_dares)
gen_truths = dedup([finalize_truth(t) for t in new_truths + hard_truths + hx_truths], seen)

random.shuffle(gen_dares)
random.shuffle(gen_truths)
final_dares  = orig_dares  + gen_dares[:5000 - len(orig_dares)]
final_truths = orig_truths + gen_truths[:5000 - len(orig_truths)]

cards, cid = [], 1
for t in final_dares:
    cards.append({"id": cid, "type": "dare", "level": "brulant", "text": t}); cid += 1
for t in final_truths:
    cards.append({"id": cid, "type": "truth", "level": "brulant", "text": t}); cid += 1

texts = [c["text"] for c in cards]
assert len(texts) == len(set(texts)) == 10000, "Doublons détectés !"
assert len(final_dares) == 5000 and len(final_truths) == 5000, "Comptage erroné"

print("Total cartes :", len(cards))
from collections import Counter
cnt = Counter((c["level"], c["type"]) for c in cards)
for k in sorted(cnt):
    print("  ", k, "->", cnt[k])

json.dump(cards, open("cards.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("cards.json écrit (10000 cartes)")

# ----------------------------------------------------------------------
# 6) SQL
# ----------------------------------------------------------------------
def esc(s):
    return s.replace("'", "''")

insert_block = "insert into public.cards (type, level, text) values\n" + ",\n".join(
    "('%s', '%s', '%s')" % (c["type"], c["level"], esc(c["text"])) for c in cards
) + ";"

# --- Découpage des cartes en 2 blocs pour des scripts SQL légers ---
half = 5000
def make_block(sublist):
    return "insert into public.cards (type, level, text) values\n" + ",\n".join(
        "('%s', '%s', '%s')" % (c["type"], c["level"], esc(c["text"])) for c in sublist
    ) + ";"

insert_block_a = make_block(cards[:half])
insert_block_b = make_block(cards[half:])

HEADER = """-- =====================================================================
--  ACTION OU VERITE -- BACKEND SUPABASE COMPLET (fichier unique)
--  10000 cartes niveau "brulant" (5000 actions + 5000 vérités, français courant,
--  3 variantes de cible : sans cible / « la personne de ton choix » / « {nom} »)
--  Supabase -> SQL Editor -> New query -> coller tout -> RUN
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists public.cards (
  id        bigint generated by default as identity primary key,
  type      text not null check (type in ('truth', 'dare')),
  level     text not null check (level in ('brulant')),
  text      text not null,
  is_used   boolean not null default false,
  last_used timestamptz
);
create index if not exists cards_level_type_idx on public.cards (level, type);

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sex        text not null default 'h',
  score      integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id          bigint generated by default as identity primary key,
  player_id   uuid references public.players(id) on delete set null,
  player_name text,
  type        text,
  text        text,
  done        boolean not null default false,
  level       text,
  created_at  timestamptz not null default now()
);
create index if not exists history_id_idx on public.history (id desc);

alter table public.cards    enable row level security;
alter table public.players  enable row level security;
alter table public.history  enable row level security;

drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read" on public.cards for select using (true);

drop policy if exists "players_anon_all" on public.players;
create policy "players_anon_all" on public.players for all using (true) with check (true);

drop policy if exists "history_anon_all" on public.history;
create policy "history_anon_all" on public.history for all using (true) with check (true);

create or replace function public.draw_card(p_type text, p_level text)
returns public.cards
language plpgsql
security definer
set search_path = public
as $fn$
declare
  picked public.cards%rowtype;
begin
  if p_type not in ('truth','dare') or p_level not in ('brulant') then
    raise exception 'type ou niveau invalide';
  end if;

  select * into picked
    from public.cards
   where type = p_type and level = p_level and is_used is not true
   order by random()
   limit 1;

  if picked.id is null then
    update public.cards set is_used = false, last_used = null
     where type = p_type and level = p_level;
    select * into picked
      from public.cards
     where type = p_type and level = p_level and is_used is not true
     order by random()
     limit 1;
  end if;

  update public.cards set is_used = true, last_used = now() where id = picked.id;
  return picked;
end;
$fn$;

create or replace function public.stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $fn$
  select jsonb_build_object(
    'players', (select count(*) from public.players),
    'cards',   (select count(*) from public.cards),
    'history', (select count(*) from public.history),
    'remaining', (
      select coalesce(jsonb_object_agg(level, per_level), '{}'::jsonb) from (
        select level,
               jsonb_build_object(
                 'truth', count(*) filter (where type = 'truth' and is_used is not true),
                 'dare',  count(*) filter (where type = 'dare'  and is_used is not true)
               ) as per_level
          from public.cards
         group by level
      ) t
    )
  );
$fn$;

create or replace function public.reset_game()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.players set score = 0 where score <> 0;
  delete from public.history where id > 0;
  update public.cards set is_used = false, last_used = null where is_used = true;
end;
$fn$;

create or replace function public.clear_history()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.history where id > 0;
end;
$fn$;

create or replace function public.new_game()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.cards set is_used = false, last_used = null where is_used = true;
end;
$fn$;

grant usage on schema public to anon, authenticated;
grant select on public.cards to anon, authenticated;
grant select, insert, update, delete on public.players to anon, authenticated;
grant select, insert, update, delete on public.history to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

grant execute on function public.draw_card(text, text) to anon, authenticated;
grant execute on function public.stats() to anon, authenticated;
grant execute on function public.reset_game() to anon, authenticated;
grant execute on function public.clear_history() to anon, authenticated;
grant execute on function public.new_game() to anon, authenticated;

do $seed$
begin
  if (select count(*) from public.cards) = 0 then
"""

FOOTER = """  end if;
end
$seed$;
"""

AUTH_SQL = """
-- =====================================================================
--  COMPTES (nom d'utilisateur + code PIN) & DÉFIS PERSONNELS
-- =====================================================================
create extension if not exists pgcrypto;

alter table public.players add column if not exists sex text not null default 'h';

create table if not exists public.accounts (
  id         bigint generated by default as identity primary key,
  username   text not null unique,
  pin_hash   text,
  created_at timestamptz not null default now()
);
alter table public.accounts drop column if exists pass_hash;

create table if not exists public.sessions (
  token      uuid not null default gen_random_uuid() primary key,
  account_id bigint not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_cards (
  id         bigint generated by default as identity primary key,
  account_id bigint not null references public.accounts(id) on delete cascade,
  type       text not null check (type in ('truth','dare')),
  level      text not null default 'brulant',
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists user_cards_account_type_idx on public.user_cards (account_id, type);

-- Colonnes "communauté" : un défi publié rejoint le paquet commun (accessible à tous)
alter table public.cards       add column if not exists source    text not null default 'base';
alter table public.cards       add column if not exists author_id bigint;
alter table public.user_cards  add column if not exists public_id bigint;

alter table public.accounts   enable row level security;
alter table public.sessions   enable row level security;
alter table public.user_cards enable row level security;

drop function if exists public.sign_up(text, text, text);
drop function if exists public.sign_in(text, text, text);

create or replace function public.sign_up(p_username text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_id bigint;
  v_token uuid;
begin
  p_username := lower(btrim(coalesce(p_username, '')));
  if p_username !~ '^[[:alnum:]_.-]{3,20}$' then
    raise exception 'Nom d''utilisateur invalide (3 a 20 caracteres : lettres, chiffres, . _ -)';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'Le code PIN doit contenir 4 chiffres';
  end if;
  if exists (select 1 from public.accounts where username = p_username) then
    raise exception 'Ce nom d''utilisateur est deja pris';
  end if;
  insert into public.accounts (username, pin_hash)
  values (p_username, crypt(p_pin, gen_salt('bf')))
  returning id into v_id;
  insert into public.sessions (account_id) values (v_id) returning token into v_token;
  return json_build_object('token', v_token, 'account_id', v_id, 'username', p_username);
end;
$fn$;

create or replace function public.sign_in(p_username text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_id bigint;
  v_token uuid;
  v_pin text;
begin
  p_username := lower(btrim(coalesce(p_username, '')));
  select id, pin_hash into v_id, v_pin from public.accounts where username = p_username;
  if v_id is null or v_pin is null or crypt(p_pin, v_pin) <> v_pin then
    raise exception 'Identifiants invalides';
  end if;
  insert into public.sessions (account_id) values (v_id) returning token into v_token;
  return json_build_object('token', v_token, 'account_id', v_id, 'username', p_username);
end;
$fn$;

create or replace function public.me(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v json;
begin
  select coalesce((
    select json_build_object('id', a.id, 'username', a.username)
      from public.sessions s
      join public.accounts a on a.id = s.account_id
     where s.token = p_token
  ), 'null'::json) into v;
  return v;
end;
$fn$;

create or replace function public.sign_out(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.sessions where token = p_token;
end;
$fn$;

create or replace function public.add_card(p_token uuid, p_type text, p_text text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  v_id  bigint;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  if p_type not in ('truth','dare') then raise exception 'Type invalide'; end if;
  p_text := btrim(coalesce(p_text, ''));
  if length(p_text) < 4 then raise exception 'Texte trop court (4 caracteres minimum)'; end if;
  insert into public.user_cards (account_id, type, text) values (v_acc, p_type, p_text)
  returning id into v_id;
  return json_build_object('id', v_id, 'type', p_type, 'text', p_text);
end;
$fn$;

create or replace function public.import_cards(p_token uuid, p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  c jsonb;
  t text;
  tx text;
  n integer := 0;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  for c in select * from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) loop
    t := lower(coalesce(c->>'type', ''));
    if t not in ('truth','dare') then continue; end if;
    tx := btrim(coalesce(c->>'text', ''));
    if length(tx) < 4 then continue; end if;
    insert into public.user_cards (account_id, type, text) values (v_acc, t, tx);
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

create or replace function public.my_cards(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_acc bigint;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  return coalesce((
    select json_agg(x) from (
      select json_build_object('id', id, 'type', type, 'level', level, 'text', text, 'public_id', public_id) as x
        from public.user_cards
       where account_id = v_acc
       order by id desc
       limit 2000
    ) t
  ), '[]'::json);
end;
$fn$;

create or replace function public.delete_card(p_token uuid, p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  delete from public.user_cards where id = p_card_id and account_id = v_acc;
end;
$fn$;

create or replace function public.publish_card(p_token uuid, p_card_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  uc public.user_cards%rowtype;
  nid bigint;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  select * into uc from public.user_cards where id = p_card_id and account_id = v_acc;
  if uc.id is null then raise exception 'Défi introuvable'; end if;
  if uc.public_id is not null then
    return json_build_object('id', uc.public_id, 'already', true);
  end if;
  insert into public.cards (type, level, text, source, author_id)
  values (uc.type, 'brulant', uc.text, 'community', v_acc)
  returning id into nid;
  update public.user_cards set public_id = nid where id = uc.id;
  return json_build_object('id', nid, 'already', false);
end;
$fn$;

create or replace function public.unpublish_card(p_token uuid, p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  uc public.user_cards%rowtype;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  select * into uc from public.user_cards where id = p_card_id and account_id = v_acc;
  if uc.id is null then raise exception 'Défi introuvable'; end if;
  delete from public.cards where id = uc.public_id and source = 'community' and author_id = v_acc;
  update public.user_cards set public_id = null where id = uc.id;
end;
$fn$;

create or replace function public.update_card(p_token uuid, p_card_id bigint, p_text text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  uc public.user_cards%rowtype;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  select * into uc from public.user_cards where id = p_card_id and account_id = v_acc;
  if uc.id is null then raise exception 'Défi introuvable'; end if;
  p_text := btrim(coalesce(p_text, ''));
  if length(p_text) < 4 then raise exception 'Texte trop court (4 caracteres minimum)'; end if;
  update public.user_cards set text = p_text where id = uc.id;
  -- si le défi est publié, on répercute la modification dans le paquet commun
  if uc.public_id is not null then
    update public.cards set text = p_text where id = uc.public_id;
  end if;
  return json_build_object('id', uc.id, 'text', p_text, 'public_id', uc.public_id);
end;
$fn$;

create or replace function public.publish_all_cards(p_token uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_acc bigint;
  uc record;
  nid bigint;
  n integer := 0;
begin
  select account_id into v_acc from public.sessions where token = p_token;
  if v_acc is null then raise exception 'Non connecte'; end if;
  for uc in
    select * from public.user_cards
     where account_id = v_acc and public_id is null
  loop
    insert into public.cards (type, level, text, source, author_id)
    values (uc.type, 'brulant', uc.text, 'community', v_acc)
    returning id into nid;
    update public.user_cards set public_id = nid where id = uc.id;
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

grant execute on function public.sign_up(text, text) to anon, authenticated;
grant execute on function public.sign_in(text, text) to anon, authenticated;
grant execute on function public.me(uuid) to anon, authenticated;
grant execute on function public.sign_out(uuid) to anon, authenticated;
grant execute on function public.add_card(uuid, text, text) to anon, authenticated;
grant execute on function public.import_cards(uuid, jsonb) to anon, authenticated;
grant execute on function public.my_cards(uuid) to anon, authenticated;
grant execute on function public.delete_card(uuid, bigint) to anon, authenticated;
grant execute on function public.publish_card(uuid, bigint) to anon, authenticated;
grant execute on function public.unpublish_card(uuid, bigint) to anon, authenticated;
grant execute on function public.update_card(uuid, bigint, text) to anon, authenticated;
grant execute on function public.publish_all_cards(uuid) to anon, authenticated;
"""

with open("supabase.sql", "w", encoding="utf-8") as f:
    f.write(HEADER + "    " + insert_block.replace("\n", "\n    ") + "\n" + FOOTER + AUTH_SQL)

MIGRATION = """-- =====================================================================
--  MIGRATION (PARTIE 1/2) : schéma + fonctions + comptes + cartes 1 à 5000
--  À exécuter D'ABORD : Supabase -> SQL Editor -> New query -> coller -> RUN
--  Puis exécuter migration_cards_2.sql (cartes 5001 à 10000)
-- =====================================================================
begin;

create extension if not exists pgcrypto;

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sex        text not null default 'h',
  score      integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id          bigint generated by default as identity primary key,
  player_id   uuid references public.players(id) on delete set null,
  player_name text,
  type        text,
  text        text,
  done        boolean not null default false,
  level       text,
  created_at  timestamptz not null default now()
);
create index if not exists history_id_idx on public.history (id desc);

alter table public.players enable row level security;
alter table public.history enable row level security;
drop policy if exists "players_anon_all" on public.players;
create policy "players_anon_all" on public.players for all using (true) with check (true);
drop policy if exists "history_anon_all" on public.history;
create policy "history_anon_all" on public.history for all using (true) with check (true);

drop table if exists public.cards cascade;

create table public.cards (
  id        bigint generated by default as identity primary key,
  type      text not null check (type in ('truth', 'dare')),
  level     text not null check (level in ('brulant')),
  text      text not null,
  is_used   boolean not null default false,
  last_used timestamptz
);
create index cards_level_type_idx on public.cards (level, type);

alter table public.cards enable row level security;
drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read" on public.cards for select using (true);
grant select on public.cards to anon, authenticated;

""" + insert_block_a + """

create or replace function public.draw_card(p_type text, p_level text)
returns public.cards
language plpgsql
security definer
set search_path = public
as $fn$
declare
  picked public.cards%rowtype;
begin
  if p_type not in ('truth','dare') or p_level not in ('brulant') then
    raise exception 'type ou niveau invalide';
  end if;

  select * into picked
    from public.cards
   where type = p_type and level = p_level and is_used is not true
   order by random()
   limit 1;

  if picked.id is null then
    update public.cards set is_used = false, last_used = null
     where type = p_type and level = p_level;
    select * into picked
      from public.cards
     where type = p_type and level = p_level and is_used is not true
     order by random()
     limit 1;
  end if;

  update public.cards set is_used = true, last_used = now() where id = picked.id;
  return picked;
end;
$fn$;

create or replace function public.reset_game()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.players set score = 0 where score <> 0;
  delete from public.history where id > 0;
  update public.cards set is_used = false, last_used = null where is_used = true;
end;
$fn$;

create or replace function public.clear_history()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.history where id > 0;
end;
$fn$;

create or replace function public.new_game()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.cards set is_used = false, last_used = null where is_used = true;
end;
$fn$;

grant execute on function public.draw_card(text, text) to anon, authenticated;
grant execute on function public.reset_game() to anon, authenticated;
grant execute on function public.clear_history() to anon, authenticated;
grant execute on function public.new_game() to anon, authenticated;

""" + AUTH_SQL + """

commit;
"""

with open("migration_cards.sql", "w", encoding="utf-8") as f:
    f.write(MIGRATION)

MIGRATION_PART2 = """-- =====================================================================
--  MIGRATION (PARTIE 2/2) : cartes 5001 à 10000
--  À exécuter APRÈS migration_cards.sql (la table public.cards doit exister)
-- =====================================================================
begin;

""" + insert_block_b + """

commit;
"""

with open("migration_cards_2.sql", "w", encoding="utf-8") as f:
    f.write(MIGRATION_PART2)

print("supabase.sql + migration_cards.sql (1/2) + migration_cards_2.sql (2/2) écrits")

# échantillons
print("\nÉchantillon actions finales (variantes + registre courant) :")
for t in final_dares[:8]:
    print("  -", t)
print("\nÉchantillon vérités finales :")
for t in final_truths[:6]:
    print("  -", t)
