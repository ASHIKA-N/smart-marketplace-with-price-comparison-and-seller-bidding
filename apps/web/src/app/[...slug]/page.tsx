import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SearchPage } from "@/components/search-page";
import { ProductPage } from "@/components/product-page";
import { ShopPage, ShopsPage } from "@/components/shops-page";
import { AuthPage } from "@/components/auth-page";
import {
  FavoritesPage,
  TransactionsPage,
  RequestsPage,
  ProfilePage,
} from "@/components/account-pages";
import { SellerPage } from "@/components/seller-page";
import { AdminPage } from "@/components/admin-page";
import { Loading } from "@/components/shell";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const [first, second, third] = slug;
  let content: React.ReactNode;
  if (first === "search" && slug.length === 1) content = <SearchPage />;
  else if (
    [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "verify-email",
    ].includes(first) &&
    slug.length === 1
  )
    content = (
      <AuthPage
        mode={
          first as
            | "login"
            | "register"
            | "forgot-password"
            | "reset-password"
            | "verify-email"
        }
      />
    );
  else if (
    first === "products" &&
    second &&
    (!third || third === "compare") &&
    slug.length <= 3
  )
    content = <ProductPage id={second} compare={third === "compare"} />;
  else if (first === "shops" && slug.length <= 2)
    content =
      second && second !== "nearby" ? (
        <ShopPage id={second} />
      ) : (
        <ShopsPage nearby={second === "nearby"} />
      );
  else if (first === "favorites" && slug.length === 1)
    content = <FavoritesPage />;
  else if (first === "transactions" && slug.length === 1)
    content = <TransactionsPage />;
  else if (first === "requests" && slug.length === 1)
    content = <RequestsPage />;
  else if (first === "profile" && slug.length === 1) content = <ProfilePage />;
  else if (first === "admin" && slug.length === 1) content = <AdminPage />;
  else if (
    first === "seller" &&
    slug.length <= 2 &&
    (!second ||
      [
        "shop",
        "products",
        "listings",
        "offers",
        "transactions",
        "bids",
      ].includes(second))
  )
    content = <SellerPage tab={second || ""} />;
  else notFound();
  return (
    <Suspense
      fallback={
        <div className="container section">
          <Loading />
        </div>
      }
    >
      {content}
    </Suspense>
  );
}
