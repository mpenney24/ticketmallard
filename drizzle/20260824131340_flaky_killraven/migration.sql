CREATE TYPE "order_status" AS ENUM('PENDING', 'PAID', 'EXPIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "ticket_status" AS ENUM('AVAILABLE', 'RESERVED', 'SOLD');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'PENDING'::"order_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"status" "ticket_status" DEFAULT 'AVAILABLE'::"ticket_status" NOT NULL,
	"reserved_by" uuid,
	"reserved_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ticket_id_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reserved_by_users_id_fkey" FOREIGN KEY ("reserved_by") REFERENCES "users"("id");