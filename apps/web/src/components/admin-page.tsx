"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./providers";
import {
  AuthRequired,
  PageIntro,
  EmptyState,
  Loading,
  ErrorState,
} from "./shell";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import type { PublicUser, Shop, Review } from "../../../../packages/shared/src";
export function AdminPage() {
  return (
    <AuthRequired>
      <Admin />
    </AuthRequired>
  );
}
function Admin() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin"],
    queryFn: () =>
      api<{
        users: PublicUser[];
        shops: Shop[];
        reviews: Review[];
        audits: { id: string; action: string; createdAt: string }[];
      }>("/users/admin"),
    enabled: user?.roles.includes("ADMIN"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(`/users/admin/${selected?.id}`, {
        method: "PATCH",
        body: { active: !selected?.active },
      }),
    onSuccess: () => {
      setSelected(null);
      void cache.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  if (!user?.roles.includes("ADMIN"))
    return (
      <EmptyState
        title="This space is for administrators"
        description="Your account does not have administrator access."
        href="/"
        label="Back to discovering"
      />
    );
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="NEIGHBOURHOOD OVERSIGHT"
        title="Keep local, trustworthy."
        description="Inspect accounts and review recorded administrative actions."
      />
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        data && (
          <>
            <div className="table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.name}
                        <small>{u.email}</small>
                      </td>
                      <td>{u.roles.join(", ")}</td>
                      <td>{u.active ? "Active" : "Deactivated"}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.roles.includes("ADMIN")}
                          onClick={() => {
                            mutation.reset();
                            setSelected(u);
                          }}
                        >
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 className="section-title">Audit history</h2>
            {data.audits.length ? (
              data.audits.map((a) => (
                <p className="muted" key={a.id}>
                  {new Date(a.createdAt).toLocaleString()} · {a.action}
                </p>
              ))
            ) : (
              <p className="muted">No administrative changes yet.</p>
            )}
          </>
        )
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="Update account access?"
        description={`${selected?.active ? "Deactivate" : "Reactivate"} ${selected?.email}. This action is recorded in the audit log.`}
      >
        <div className="stack">
          {mutation.error && (
            <p className="form-error">{mutation.error.message}</p>
          )}
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Confirm account update
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
