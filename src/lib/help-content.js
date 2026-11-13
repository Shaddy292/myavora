export const HELP_AUDIENCES = [
  { key: "customers", label: "For customers" },
  { key: "riders", label: "For riders" },
  { key: "vendors", label: "For vendors" },
];

export const HELP_ARTICLES = [
  {
    audience: "customers",
    category: "Orders & delivery",
    question: "How long does delivery take?",
    answer:
      "Most stores quote 20–35 minutes. You will see the live estimate on the store page before you order, and the rider's position updates on the tracking page once the store hands the order over.",
  },
  {
    audience: "customers",
    category: "Orders & delivery",
    question: "Can I cancel an order?",
    answer:
      "Yes — open the order and tap Cancel while it is still New or Accepted. Once the store starts preparing, call support from the order page and we will reach the vendor for you.",
  },
  {
    audience: "customers",
    category: "Orders & delivery",
    question: "An item is missing or wrong",
    answer:
      "Open Support, pick “Missing or wrong item” and add your order code. Attach what you can — our agents can see the exact basket the store received and will refund or re-send the item.",
  },
  {
    audience: "customers",
    category: "Payments & refunds",
    question: "How do refunds work?",
    answer:
      "Request a refund from Refund requests, choose the order and the amount. Claims move from Requested to Reviewed, then Approved or Rejected. Approved claims are processed to your original payment method within 3–5 working days.",
  },
  {
    audience: "customers",
    category: "Payments & refunds",
    question: "Can I pay with cash?",
    answer:
      "Yes. Choose cash on delivery at checkout, or card on delivery where the rider carries a POS. Set your preferred method in Payment methods so checkout is faster next time.",
  },
  {
    audience: "customers",
    category: "Account",
    question: "How do I change my delivery address?",
    answer:
      "Manage addresses lets you save several places — home, work, a friend's flat — and pick one at checkout. Mark the one you use most as default.",
  },
  {
    audience: "customers",
    category: "Account",
    question: "I forgot my password",
    answer:
      "On the sign-in page choose Forgot password, or send yourself a reset link from Profile settings → Change password. The link is valid for one use.",
  },
  {
    audience: "riders",
    category: "Getting started",
    question: "How do I become a rider?",
    answer:
      "Apply from the rider console with your name, phone, vehicle and ID. Operations reviews applications within 24 hours. You can only claim jobs once your profile is approved.",
  },
  {
    audience: "riders",
    category: "Deliveries",
    question: "I cannot reach the customer",
    answer:
      "Wait at the drop-off for five minutes and call twice. Then mark the delivery as failed with a short note — the order returns to operations and you keep the delivery fee.",
  },
  {
    audience: "riders",
    category: "Earnings",
    question: "When do I get paid?",
    answer:
      "Payouts are calculated from delivered orders and appear in Earnings as settlement statements. Cash orders you collect are offset against your settlement balance.",
  },
  {
    audience: "riders",
    category: "Earnings",
    question: "What is cash on hand?",
    answer:
      "It is the cash you have collected from customers on AVORA cash orders. It is tracked so finance can net it out when your settlement is paid.",
  },
  {
    audience: "vendors",
    category: "Partnership",
    question: "How do I open my store on AVORA?",
    answer:
      "Submit the application on Become a vendor with your business details and category. Operations verifies you within 24 hours, then your store goes live and you can add your menu.",
  },
  {
    audience: "vendors",
    category: "Running your store",
    question: "How do I pause orders?",
    answer:
      "Set the store to closed from the order board header. Closing the store hides your menu from customers immediately but keeps your catalog and history intact.",
  },
  {
    audience: "vendors",
    category: "Running your store",
    question: "An item ran out",
    answer:
      "In Inventory set the stock to zero or toggle the item to Hidden. Hidden items stay in your catalog but customers cannot order them.",
  },
  {
    audience: "vendors",
    category: "Payments",
    question: "How is commission charged?",
    answer:
      "Commission is a percentage of each delivered subtotal, shown on your store profile. Settlements list gross sales, commission and your net payout for the period.",
  },
];