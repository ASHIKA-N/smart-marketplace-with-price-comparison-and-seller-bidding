const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/api/data/marketplace.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const chennaiShops = [
  {
    id: "tech-haven-chennai",
    ownerId: "seller-demo",
    name: "Tech Haven - T. Nagar",
    description: "Your neighbourhood destination for great tech and audio in Chennai. Discover genuine electronics, personal service, and prices worth stepping out for.",
    address: "Usman Road, T. Nagar, Chennai",
    lat: 13.0418,
    lng: 80.2341,
    image: "/images/photo-1441986300917-64674bd600d8.jpg",
    rating: 4.8,
    reviews: 142,
    verified: true,
    hours: {
      open: "09:00",
      close: "22:00",
      days: [0, 1, 2, 3, 4, 5, 6]
    },
    phone: "+91 98765 43220",
    completed: 185
  },
  {
    id: "neighbourhood-chennai",
    ownerId: "seller-two",
    name: "The Neighbourhood Store - Pondy Bazaar",
    description: "Thoughtfully selected everyday essentials and lifestyle goods from brands we love in Chennai. Stop by and find something good.",
    address: "Pondy Bazaar, T. Nagar, Chennai",
    lat: 13.0403,
    lng: 80.2337,
    image: "/images/photo-1473181488821-2d23949a045a.jpg",
    rating: 4.7,
    reviews: 98,
    verified: true,
    hours: {
      open: "08:00",
      close: "21:30",
      days: [0, 1, 2, 3, 4, 5, 6]
    },
    phone: "+91 98765 43221",
    completed: 120
  },
  {
    id: "earth-clay-chennai",
    ownerId: "seller-three",
    name: "Earth & Clay Studio - Anna Nagar",
    description: "Handmade ceramics, planters, and artisanal homeware created by local Tamil Nadu makers.",
    address: "2nd Avenue, Anna Nagar, Chennai",
    lat: 13.085,
    lng: 80.2101,
    image: "/images/photo-1493857671505-72967e2e2760.jpg",
    rating: 4.9,
    reviews: 75,
    verified: true,
    hours: {
      open: "10:00",
      close: "20:00",
      days: [0, 2, 3, 4, 5, 6]
    },
    phone: "+91 98765 43222",
    completed: 92
  },
  {
    id: "green-basket-chennai",
    ownerId: "seller-four",
    name: "Green Basket - Adyar",
    description: "Fresh from the farm, close to home. Seasonal fruits, organic produce, and South Indian filter coffee beans.",
    address: "Sardar Patel Road, Adyar, Chennai",
    lat: 13.0067,
    lng: 80.2206,
    image: "/images/photo-1542838132-92c53300491e.jpg",
    rating: 4.6,
    reviews: 88,
    verified: true,
    hours: {
      open: "07:00",
      close: "22:00",
      days: [0, 1, 2, 3, 4, 5, 6]
    },
    phone: "+91 98765 43223",
    completed: 210
  }
];

// Add Chennai shops if not existing
for (const shop of chennaiShops) {
  if (!data.shops.some(s => s.id === shop.id)) {
    data.shops.push(shop);
  }
}

// Generate listings for Chennai shops for each product
const prices = [
  24990, 10995, 650, 180, 1299, 899, 7499, 450, 2499, 12999, 1199, 1799, 999,
  799, 599, 249, 299, 199, 349, 449, 549, 2299, 699, 1299
];

data.products.forEach((p, i) => {
  [0, 1, 2].forEach(j => {
    const listId = `listing-chennai-${i}-${j}`;
    if (!data.listings.some(l => l.id === listId)) {
      const shop = chennaiShops[(i + j) % chennaiShops.length];
      const basePrice = prices[i] || 1000;
      const isBidding = (i === 1 && j === 2) || (i === 5 && j === 1); // some bidding items
      data.listings.push({
        id: listId,
        productId: p.id,
        shopId: shop.id,
        price: Math.round(basePrice * (1 + j * 0.08)),
        stock: 12 + i + j,
        active: true,
        ...(isBidding ? {
          pricingMode: "BIDDING",
          minBid: Math.round(basePrice * 0.85),
          biddingDeadline: "2026-12-31T23:59:59.000Z",
          biddingOpen: true,
          unit: "1 unit"
        } : {
          pricingMode: "FIXED"
        })
      });
    }
  });
});

// Seed sample completed transactions so buyer-demo has verified purchases for reviews
const sampleTransactions = [
  {
    id: "tx-chennai-demo-1",
    buyerId: "buyer-demo",
    shopId: "tech-haven-chennai",
    productId: "sony-headphones",
    listingId: "listing-chennai-0-0",
    quantity: 1,
    unitPrice: 24990,
    total: 24990,
    status: "COMPLETED",
    pickupOtp: "847291",
    createdAt: "2026-10-15T10:30:00.000Z",
    completedAt: "2026-10-15T11:45:00.000Z"
  },
  {
    id: "tx-chennai-demo-2",
    buyerId: "buyer-demo",
    shopId: "green-basket-chennai",
    productId: "fresh-avocados",
    listingId: "listing-chennai-3-0",
    quantity: 2,
    unitPrice: 180,
    total: 360,
    status: "COMPLETED",
    pickupOtp: "194820",
    createdAt: "2026-10-16T14:10:00.000Z",
    completedAt: "2026-10-16T15:00:00.000Z"
  },
  {
    id: "tx-chennai-demo-3",
    buyerId: "buyer-demo",
    shopId: "earth-clay-chennai",
    productId: "ceramic-mug",
    listingId: "listing-chennai-2-0",
    quantity: 1,
    unitPrice: 650,
    total: 650,
    status: "CONFIRMED",
    pickupOtp: "562914",
    createdAt: "2026-10-20T09:00:00.000Z"
  }
];

for (const tx of sampleTransactions) {
  if (!data.transactions.some(t => t.id === tx.id)) {
    data.transactions.push(tx);
  }
}

// Seed sample reviews
const sampleReviews = [
  {
    id: "rev-chennai-1",
    shopId: "tech-haven-chennai",
    productId: "sony-headphones",
    userId: "buyer-demo",
    userName: "Alex Morgan",
    rating: 5,
    comment: "Industry-leading noise cancellation and sound quality. In-store pickup at Usman Road was seamless and friendly!",
    createdAt: "2026-10-15T12:00:00.000Z",
    reply: "Thank you Alex! So glad you love the headphones. Come back anytime for audio accessories!",
    repliedAt: "2026-10-15T14:30:00.000Z"
  },
  {
    id: "rev-chennai-2",
    shopId: "green-basket-chennai",
    productId: "fresh-avocados",
    userId: "buyer-demo",
    userName: "Alex Morgan",
    rating: 4,
    comment: "Perfect ripeness, organic quality, and great service at Adyar branch. Highly recommend!",
    createdAt: "2026-10-16T16:00:00.000Z",
    reply: "Thanks for supporting our farm-to-table grocers!",
    repliedAt: "2026-10-16T17:15:00.000Z"
  }
];

for (const rev of sampleReviews) {
  if (!data.reviews.some(r => r.id === rev.id)) {
    data.reviews.push(rev);
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Successfully seeded Chennai shops and listings! Total shops:', data.shops.length, 'Total listings:', data.listings.length);

