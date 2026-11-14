// Legal copy for the Terms of Service and Privacy Policy pages.
// Plain data so both the mobile (native-style) and desktop layouts render
// the same sections, and so translations stay side by side.

export const LEGAL_UPDATED = "2026-09-08";

export const legalContent = {
  terms: {
    en: {
      title: "Terms of Service",
      subtitle: "The rules for joining auctions, paying entry fees and bidding.",
      updatedLabel: "Last updated",
      intro:
        "These terms are an agreement between you and Mazady. By creating an account, adding funds or joining an auction you accept them. If you do not agree, please do not use the platform.",
      sections: [
        {
          id: "eligibility",
          heading: "1. Who can take part",
          body: [
            "You must be at least 18 years old and legally able to enter a contract.",
            "One account per person. Accounts created with false details, or several accounts used by the same person to gain an advantage, may be suspended and their balance frozen while we review.",
            "You are responsible for keeping your password safe and for everything done through your account.",
          ],
        },
        {
          id: "entry",
          heading: "2. Joining an auction",
          body: [
            "Each auction shows a fixed entry fee and the number of seats available before you join.",
            "The entry fee is taken from your wallet balance the moment you reserve a seat.",
            "Joining gives you a seat and a number of bids for that auction. It does not guarantee that you will win.",
            "An auction starts its countdown once the required number of seats is filled.",
          ],
        },
        {
          id: "bidding",
          heading: "3. Bidding and winning",
          body: [
            "Bids are final and cannot be withdrawn once submitted.",
            "In closest-price auctions the winner is the participant whose unique bid is closest to the selling price without exceeding it. If two or more participants submit the same value, that value is cancelled for everyone.",
            "In ascending auctions the highest valid bid when the timer ends wins.",
            "You may run out of included bids and choose to buy extra bids. Extra bids are paid from your wallet and are used immediately.",
            "We may extend a countdown slightly when bids arrive in the final seconds, so that no one wins purely on timing.",
          ],
        },
        {
          id: "wallet",
          heading: "4. Wallet, fees and payments",
          body: [
            "Your wallet balance is a prepaid credit used only inside the platform. It is not a bank account, it earns no interest and it has no value outside the platform.",
            "Top-ups may be made by the payment methods shown on the deposit screen. Some methods are reviewed by our team before the balance appears.",
            "Entry fees and bid fees are consumed when used and are not refundable once an auction has started.",
            "If you win, we send you a payment link for the remaining amount of the item. Ownership passes only after that payment clears.",
            "Prices are shown in the currency displayed on screen. Bank or card charges from your provider are your responsibility.",
          ],
        },
        {
          id: "refunds",
          heading: "5. Cancellations and refunds",
          body: [
            "If we cancel or void an auction before it starts, entry fees for that auction are returned to your wallet.",
            "You can request a refund of an unused top-up from the wallet screen. We may ask you to confirm your identity first.",
            "Refunds are returned to the original payment method where possible, otherwise as wallet balance.",
          ],
        },
        {
          id: "conduct",
          heading: "6. Fair use",
          body: [
            "Do not use bots, scripts or automated tools to bid, and do not attempt to interfere with the auction engine.",
            "Do not coordinate with other participants to manipulate an outcome, and do not harass other users in chat.",
            "We may suspend or close accounts, cancel bids and withhold prizes where we find manipulation, fraud or abuse.",
          ],
        },
        {
          id: "liability",
          heading: "7. Availability and liability",
          body: [
            "We work to keep the platform available but cannot promise uninterrupted service. Maintenance, outages or network issues may affect access.",
            "Where an auction is clearly affected by a technical fault, we may void it and return the entry fees for that auction.",
            "To the extent permitted by law, our responsibility to you is limited to the amounts you paid us in connection with the affected auction.",
          ],
        },
        {
          id: "changes",
          heading: "8. Changes and contact",
          body: [
            "We may update these terms. Material changes will be announced in the app, and continuing to use the platform means you accept the updated terms.",
            "Questions about these terms can be sent to our support team from the account screen.",
          ],
        },
      ],
    },
    ar: {
      title: "شروط الاستخدام",
      subtitle: "قواعد الانضمام للمزادات ورسوم الاشتراك والمزايدة.",
      updatedLabel: "آخر تحديث",
      intro:
        "هذه الشروط اتفاق بينك وبين مزادتنا. بإنشاء حساب أو إضافة رصيد أو الانضمام إلى مزاد فإنك توافق عليها. إذا لم توافق، فيرجى عدم استخدام المنصة.",
      sections: [
        {
          id: "eligibility",
          heading: "١. من يمكنه المشاركة",
          body: [
            "يجب أن يكون عمرك ١٨ عاماً على الأقل وأن تكون مؤهلاً قانونياً للتعاقد.",
            "حساب واحد لكل شخص. الحسابات المسجّلة ببيانات غير صحيحة، أو استخدام عدة حسابات للشخص نفسه للحصول على ميزة، قد تُوقف ويُجمّد رصيدها أثناء المراجعة.",
            "أنت مسؤول عن الحفاظ على كلمة المرور وعن كل ما يجري من خلال حسابك.",
          ],
        },
        {
          id: "entry",
          heading: "٢. الانضمام إلى المزاد",
          body: [
            "يوضّح كل مزاد رسوم اشتراك ثابتة وعدد المقاعد المتاحة قبل انضمامك.",
            "تُخصم رسوم الاشتراك من رصيد محفظتك لحظة حجز المقعد.",
            "الانضمام يمنحك مقعداً وعدداً من المزايدات في ذلك المزاد، ولا يضمن الفوز.",
            "يبدأ العدّ التنازلي للمزاد عند اكتمال عدد المقاعد المطلوب.",
          ],
        },
        {
          id: "bidding",
          heading: "٣. المزايدة والفوز",
          body: [
            "المزايدات نهائية ولا يمكن سحبها بعد إرسالها.",
            "في مزادات أقرب سعر يفوز المشارك الذي يقدّم رقماً فريداً هو الأقرب إلى سعر البيع دون تجاوزه. وإذا قدّم شخصان أو أكثر الرقم نفسه يُلغى ذلك الرقم للجميع.",
            "في المزادات التصاعدية تفوز أعلى مزايدة صالحة عند انتهاء الوقت.",
            "قد تنتهي مزايداتك المجانية فتختار شراء مزايدات إضافية. تُدفع المزايدات الإضافية من محفظتك وتُستخدم فوراً.",
            "قد نمدّ العدّ التنازلي قليلاً عند وصول مزايدات في الثواني الأخيرة، حتى لا يفوز أحد بالتوقيت وحده.",
          ],
        },
        {
          id: "wallet",
          heading: "٤. المحفظة والرسوم والدفع",
          body: [
            "رصيد المحفظة رصيد مدفوع مقدماً يُستخدم داخل المنصة فقط. وهو ليس حساباً بنكياً ولا يحقّق فوائد ولا قيمة له خارج المنصة.",
            "يمكن الشحن بطرق الدفع الظاهرة في صفحة الإيداع. بعض الطرق تحتاج مراجعة من فريقنا قبل إضافة الرصيد.",
            "تُستهلك رسوم الاشتراك ورسوم المزايدة عند استخدامها ولا تُسترد بعد بدء المزاد.",
            "في حال الفوز نرسل لك رابط دفع للمبلغ المتبقي للسلعة. تنتقل الملكية بعد إتمام هذا الدفع فقط.",
            "الأسعار معروضة بالعملة الظاهرة على الشاشة، وأي رسوم بنكية أو رسوم بطاقة من مزوّدك تقع على مسؤوليتك.",
          ],
        },
        {
          id: "refunds",
          heading: "٥. الإلغاء والاسترداد",
          body: [
            "إذا ألغينا مزاداً قبل بدئه، تُعاد رسوم اشتراك ذلك المزاد إلى محفظتك.",
            "يمكنك طلب استرداد رصيد شحن غير مستخدم من صفحة المحفظة، وقد نطلب تأكيد هويتك أولاً.",
            "يُعاد الاسترداد إلى وسيلة الدفع الأصلية عند الإمكان، وإلا فكرصيد في المحفظة.",
          ],
        },
        {
          id: "conduct",
          heading: "٦. الاستخدام العادل",
          body: [
            "لا تستخدم برامج آلية أو سكربتات للمزايدة، ولا تحاول التأثير على محرّك المزادات.",
            "لا تتنسّق مع مشاركين آخرين للتلاعب بالنتيجة، ولا تُسِئ لمستخدمين آخرين في المحادثة.",
            "يحق لنا إيقاف الحسابات أو إغلاقها وإلغاء المزايدات وحجب الجوائز عند ثبوت تلاعب أو احتيال أو إساءة.",
          ],
        },
        {
          id: "liability",
          heading: "٧. التوافر والمسؤولية",
          body: [
            "نعمل على إتاحة المنصة دائماً لكن لا يمكننا ضمان خدمة بلا انقطاع؛ فقد تؤثر أعمال الصيانة أو الأعطال أو الشبكة على الوصول.",
            "إذا تأثر مزاد بخلل تقني واضح، فقد نُلغيه ونعيد رسوم الاشتراك الخاصة به.",
            "بالقدر الذي يسمح به القانون، تقتصر مسؤوليتنا تجاهك على المبالغ التي دفعتها لنا بخصوص المزاد المتأثر.",
          ],
        },
        {
          id: "changes",
          heading: "٨. التغييرات والتواصل",
          body: [
            "قد نُحدّث هذه الشروط، وسيُعلن عن أي تغيير جوهري داخل التطبيق، واستمرارك في الاستخدام يعني موافقتك على النسخة المحدّثة.",
            "لأي سؤال عن هذه الشروط تواصل مع فريق الدعم من صفحة الحساب.",
          ],
        },
      ],
    },
  },

  privacy: {
    en: {
      title: "Privacy Policy",
      subtitle: "What we collect, why we need it and the choices you have.",
      updatedLabel: "Last updated",
      intro:
        "We only collect what we need to run auctions, process wallet transactions and keep the platform fair. We never sell your personal data.",
      sections: [
        {
          id: "collect",
          heading: "1. Information we collect",
          body: [
            "Account details you give us: first and last name, email address, phone number and country.",
            "Activity created by using the app: auctions you join, bids you place, wallet transactions, notifications and support messages.",
            "Technical data: device type, browser, language, approximate country from your IP address, and log records used to detect abuse.",
          ],
        },
        {
          id: "use",
          heading: "2. How we use it",
          body: [
            "To create and secure your account and to sign you in.",
            "To run auctions: seats, bid quotas, winner selection and payment of prizes.",
            "To process top-ups, entry fees, extra bids and refunds.",
            "To send you service messages such as bid alerts, round starts, winner notices and password resets.",
            "To detect fraud, duplicate accounts and manipulation, and to meet legal or accounting obligations.",
          ],
        },
        {
          id: "visibility",
          heading: "3. What other users can see",
          body: [
            "Other participants in an auction can see a shortened form of your name (for example a first name and an initial) together with your bids in that auction.",
            "Your email address, phone number, wallet balance and transaction history are never shown to other users.",
          ],
        },
        {
          id: "sharing",
          heading: "4. Who we share it with",
          body: [
            "Service providers who host the platform, send email and process card payments, strictly to perform those services for us.",
            "Authorities, where we are required to by law or to protect our rights.",
            "We do not sell your personal data and we do not share it for third-party advertising.",
          ],
        },
        {
          id: "retention",
          heading: "5. How long we keep it",
          body: [
            "Account and auction records are kept while your account is active.",
            "Financial records such as top-ups, entry fees and prize payments are kept for as long as accounting and legal rules require, even after an account is closed.",
            "Technical logs are kept for a short period and then deleted or anonymised.",
          ],
        },
        {
          id: "rights",
          heading: "6. Your choices",
          body: [
            "You can view and edit your profile details at any time from the account screen.",
            "You can ask us for a copy of your data, ask us to correct it, or ask us to delete your account and associated data. Financial records we must keep by law are an exception.",
            "You can turn service notifications off on your device, though important account and auction messages may still be sent by email.",
          ],
        },
        {
          id: "security",
          heading: "7. Security and contact",
          body: [
            "Data is transmitted over encrypted connections, passwords are stored hashed, and access to production data is restricted to authorised staff.",
            "No system is perfectly secure, so please use a strong, unique password and tell us straight away if you suspect unauthorised access.",
            "For any privacy request, contact our support team from the account screen.",
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      subtitle: "ما نجمعه ولماذا نحتاجه والخيارات المتاحة لك.",
      updatedLabel: "آخر تحديث",
      intro:
        "نجمع فقط ما نحتاجه لتشغيل المزادات ومعالجة معاملات المحفظة والحفاظ على العدالة. ولا نبيع بياناتك الشخصية أبداً.",
      sections: [
        {
          id: "collect",
          heading: "١. المعلومات التي نجمعها",
          body: [
            "بيانات الحساب التي تقدّمها: الاسم الأول والأخير، البريد الإلكتروني، رقم الهاتف، والدولة.",
            "النشاط الناتج عن استخدام التطبيق: المزادات التي تنضم إليها، مزايداتك، معاملات المحفظة، التنبيهات، ورسائل الدعم.",
            "بيانات تقنية: نوع الجهاز، المتصفح، اللغة، الدولة التقريبية من عنوان الـIP، وسجلات تُستخدم لكشف الإساءة.",
          ],
        },
        {
          id: "use",
          heading: "٢. كيف نستخدمها",
          body: [
            "لإنشاء حسابك وتأمينه وتسجيل دخولك.",
            "لتشغيل المزادات: المقاعد، حدود المزايدات، اختيار الفائز، وتسليم الجوائز.",
            "لمعالجة عمليات الشحن ورسوم الاشتراك والمزايدات الإضافية والاسترداد.",
            "لإرسال رسائل الخدمة مثل تنبيهات المزايدة وبدء الجولات وإشعارات الفوز وإعادة تعيين كلمة المرور.",
            "لكشف الاحتيال والحسابات المكرّرة والتلاعب، وللوفاء بالالتزامات القانونية والمحاسبية.",
          ],
        },
        {
          id: "visibility",
          heading: "٣. ما يراه المستخدمون الآخرون",
          body: [
            "يرى المشاركون في المزاد صيغة مختصرة من اسمك (مثل الاسم الأول والحرف الأول) مع مزايداتك في ذلك المزاد.",
            "لا يُظهر لأي مستخدم آخر بريدك الإلكتروني أو رقم هاتفك أو رصيد محفظتك أو سجل معاملاتك.",
          ],
        },
        {
          id: "sharing",
          heading: "٤. مع من نشاركها",
          body: [
            "مزوّدو خدمات الاستضافة وإرسال البريد ومعالجة الدفع بالبطاقة، وذلك لتأدية هذه الخدمات لنا فقط.",
            "الجهات الرسمية عند إلزامنا قانوناً أو لحماية حقوقنا.",
            "لا نبيع بياناتك الشخصية ولا نشاركها لأغراض إعلانات الأطراف الثالثة.",
          ],
        },
        {
          id: "retention",
          heading: "٥. مدة الاحتفاظ",
          body: [
            "تُحفظ بيانات الحساب وسجلات المزادات طوال فترة نشاط حسابك.",
            "تُحفظ السجلات المالية مثل الشحن ورسوم الاشتراك ومدفوعات الجوائز للمدة التي تفرضها القواعد المحاسبية والقانونية، حتى بعد إغلاق الحساب.",
            "تُحفظ السجلات التقنية لمدة قصيرة ثم تُحذف أو تُجهّل هويتها.",
          ],
        },
        {
          id: "rights",
          heading: "٦. خياراتك",
          body: [
            "يمكنك عرض بيانات ملفك وتعديلها في أي وقت من صفحة الحساب.",
            "يمكنك طلب نسخة من بياناتك أو تصحيحها أو حذف حسابك والبيانات المرتبطة به، باستثناء السجلات المالية التي يلزمنا القانون بحفظها.",
            "يمكنك إيقاف تنبيهات الخدمة من جهازك، مع إمكانية إرسال رسائل الحساب والمزادات المهمة عبر البريد.",
          ],
        },
        {
          id: "security",
          heading: "٧. الأمان والتواصل",
          body: [
            "تُنقل البيانات عبر اتصالات مشفّرة، وتُخزّن كلمات المرور مُعمّاة، والوصول إلى بيانات التشغيل مقصور على الموظفين المخوّلين.",
            "لا يوجد نظام آمن تماماً، لذا استخدم كلمة مرور قوية وفريدة وأبلغنا فوراً عند الاشتباه بأي وصول غير مصرّح به.",
            "لأي طلب متعلق بالخصوصية تواصل مع فريق الدعم من صفحة الحساب.",
          ],
        },
      ],
    },
  },
};

export function getLegalDoc(kind, lang) {
  const doc = legalContent[kind] || legalContent.terms;
  return doc[lang === "ar" ? "ar" : "en"];
}
