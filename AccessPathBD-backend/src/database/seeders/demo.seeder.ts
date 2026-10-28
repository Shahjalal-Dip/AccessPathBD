import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { Seeder } from "nestjs-seeder";
import { DataSource } from "typeorm";
import {
  BuildingCategory as C,
  FeatureStatus,
  FeatureType as F,
  ModerationDecision,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";
import { Role } from "@/common/enums/role.enum";
import { appConfig } from "@/config/app.config";
import { AuditLog } from "@/modules/audit/entities/audit-log.entity";
import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { computeFeatureState } from "@/modules/features/feature-status.util";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import { Report } from "@/modules/reports/entities/report.entity";
import { Review } from "@/modules/reviews/entities/review.entity";
import { ReviewStatus } from "@/common/enums/accessibility.enums";
import { User } from "@/modules/users/entities/user.entity";

type Scenario = "yes" | "no" | "partial" | "stale" | "disputed" | "unverified";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** What each scenario means in terms of approved reports (days = how long ago observed). */
const SCENARIOS: Record<Scenario, { status: FeatureStatus; days: number }[]> = {
  yes: [{ status: FeatureStatus.AVAILABLE, days: 12 }],
  no: [{ status: FeatureStatus.UNAVAILABLE, days: 9 }],
  partial: [{ status: FeatureStatus.PARTIAL, days: 20 }],
  stale: [{ status: FeatureStatus.AVAILABLE, days: 160 }], // older than FRESHNESS_DAYS
  disputed: [
    { status: FeatureStatus.AVAILABLE, days: 4 },
    { status: FeatureStatus.UNAVAILABLE, days: 14 }, // within CONFLICT_WINDOW_DAYS => disputed
  ],
  unverified: [],
};

// PLACEHOLDER campus data. Replace names/coordinates with your real buildings.
const BUILDINGS: {
  name: string;
  category: C;
  address: string;
  lat: number;
  lng: number;
  profile: Partial<Record<F, Scenario>>;
}[] = [
  {
    name: "Main Academic Building",
    category: C.ACADEMIC,
    address: "University Campus, Dhaka",
    lat: 23.7289,
    lng: 90.3984,
    profile: {
      STEP_FREE_ENTRANCE: "yes",
      RAMP: "yes",
      LIFT: "disputed",
      ACCESSIBLE_TOILET: "no",
    },
  },
  {
    name: "Central Library",
    category: C.LIBRARY,
    address: "University Campus, Dhaka",
    lat: 23.7295,
    lng: 90.3991,
    profile: {
      STEP_FREE_ENTRANCE: "yes",
      LIFT: "yes",
      ACCESSIBLE_TOILET: "partial",
      WIDE_DOORS: "yes",
    },
  },
  {
    name: "Administration Building",
    category: C.ADMINISTRATION,
    address: "University Campus, Dhaka",
    lat: 23.7281,
    lng: 90.3975,
    profile: { STEP_FREE_ENTRANCE: "stale", RAMP: "stale", LIFT: "unverified" },
  },
  {
    name: "Science Faculty Block",
    category: C.ACADEMIC,
    address: "University Campus, Dhaka",
    lat: 23.7302,
    lng: 90.3969,
    profile: { STEP_FREE_ENTRANCE: "no", RAMP: "no", LIFT: "no" },
  },
  {
    name: "Student Centre & Cafeteria",
    category: C.FOOD,
    address: "University Campus, Dhaka",
    lat: 23.7276,
    lng: 90.3999,
    profile: {
      STEP_FREE_ENTRANCE: "yes",
      ACCESSIBLE_TOILET: "yes",
      UNOBSTRUCTED_ROUTE: "partial",
    },
  },
  {
    name: "Campus Medical Centre",
    category: C.HEALTH,
    address: "University Campus, Dhaka",
    lat: 23.727,
    lng: 90.3962,
    profile: {
      STEP_FREE_ENTRANCE: "yes",
      RAMP: "yes",
      ACCESSIBLE_TOILET: "yes",
      ACCESSIBLE_PARKING: "partial",
    },
  },
  {
    name: "Central Mosque",
    category: C.RELIGIOUS,
    address: "University Campus, Dhaka",
    lat: 23.731,
    lng: 90.398,
    profile: {
      STEP_FREE_ENTRANCE: "partial",
      RAMP: "yes",
      ACCESSIBLE_TOILET: "unverified",
    },
  },
  {
    name: "Sports Complex",
    category: C.SPORTS,
    address: "University Campus, Dhaka",
    lat: 23.7262,
    lng: 90.401,
    profile: {
      STEP_FREE_ENTRANCE: "yes",
      ACCESSIBLE_PARKING: "yes",
      ACCESSIBLE_TOILET: "stale",
    },
  },
  {
    name: "Nearby Bank Branch",
    category: C.OTHER,
    address: "Road 1, Near University Gate, Dhaka",
    lat: 23.7255,
    lng: 90.394,
    profile: { STEP_FREE_ENTRANCE: "no", LIFT: "yes" },
  },
  {
    name: "Nearby Upazila Health Complex",
    category: C.HEALTH,
    address: "Main Road, Near University, Dhaka",
    lat: 23.734,
    lng: 90.392,
    profile: {
      STEP_FREE_ENTRANCE: "partial",
      RAMP: "partial",
      ACCESSIBLE_TOILET: "no",
    },
  },
];

const label = (t: string) => t.toLowerCase().replace(/_/g, " ");

@Injectable()
export class DemoSeeder implements Seeder {
  constructor(private readonly ds: DataSource) {}

  async seed() {
    if (appConfig.env.NODE_ENV === "production")
      throw new Error("Refusing to seed demo data in production");

    if (await this.ds.getRepository(User).count()) {
      console.log(
        "Database already has users. Run `pnpm seeder:refresh:dev` to reset it.",
      );
      return;
    }

    const password = process.env.SEED_PASSWORD ?? "Passw0rd!demo";
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await this.ds.transaction(async (em) => {
      const [admin, moderator, contributor] = await em.save(
        User,
        [
          {
            fullName: "Admin",
            email: "admin@gmail.com",
            role: Role.ADMIN,
          },
          {
            fullName: "Moderator",
            email: "moderator@gmail.com",
            role: Role.MODERATOR,
          },
          {
            fullName: "Contributor",
            email: "contributor@gmail.com",
            role: Role.CONTRIBUTOR,
          },
        ].map((u) => em.create(User, { ...u, passwordHash })),
      );

      const pendingTargets: AccessibilityFeature[] = [];

      for (const b of BUILDINGS) {
        const building = await em.save(
          em.create(Building, {
            name: b.name,
            address: b.address,
            category: b.category,
            description: `Demo record for ${b.name}. Replace with real campus data.`,
            latitude: b.lat,
            longitude: b.lng,
            createdById: admin.id,
          }),
        );

        for (const [type, scenario] of Object.entries(b.profile) as [
          F,
          Scenario,
        ][]) {
          let feature = await em.save(
            em.create(AccessibilityFeature, {
              buildingId: building.id,
              featureType: type,
            }),
          );
          const approved: Report[] = [];

          for (const s of SCENARIOS[scenario]) {
            const observedAt = daysAgo(s.days);
            const decidedAt = new Date(
              Math.min(Date.now(), observedAt.getTime() + DAY),
            );
            const report = await em.save(
              em.create(Report, {
                buildingId: building.id,
                featureId: feature.id,
                submittedById: contributor.id,
                observationStatus: s.status,
                observedAt,
                decidedAt,
                createdAt: observedAt,
                moderationStatus: ModerationStatus.APPROVED,
                description: `Seed observation: ${label(type)} is ${s.status.toLowerCase()} at ${b.name}.`,
              }),
            );
            await em.insert(Verification, {
              reportId: report.id,
              reviewedById: moderator.id,
              decision: ModerationDecision.APPROVED,
              decisionReason: null,
            });
            approved.push(report);
          }

          const state = computeFeatureState(
            approved,
            appConfig.env.CONFLICT_WINDOW_DAYS,
          );
          Object.assign(feature, {
            status: state.status,
            verificationStatus: state.verificationStatus,
            lastObservedAt: state.lastObservedAt,
            lastVerifiedAt: state.lastVerifiedAt,
          });
          feature = await em.save(feature);
          if (scenario === "unverified") pendingTargets.push(feature);
        }
      }

      // Demo reviews (opinions; moderated separately from accessibility reports)
      const [rafiq, tanvir] = await em.save(
        User,
        [
          {
            fullName: "Rafiq Hasan",
            email: "rafiq@gmail.com",
            role: Role.CONTRIBUTOR,
          },
          {
            fullName: "Tanvir Mahmud",
            email: "tanvir@gmail.com",
            role: Role.CONTRIBUTOR,
          },
        ].map((u) => em.create(User, { ...u, passwordHash })),
      );
      const allBuildings = await em.find(Building, { order: { name: "ASC" } });
      const REVIEW_TEXT = [
        [
          5,
          "The side entrance worked for my wheelchair",
          "I used the side ramp with my wheelchair. The main entrance had steps, so finding the side route mattered. A staff member helped me locate it and the doors opened easily.",
          rafiq,
        ],
        [
          4,
          "Useful facilities, but check availability",
          "The lift was running when I visited and I found a toilet with grab rails on the ground floor. I needed to ask reception for directions, so allow a little extra time for your visit.",
          tanvir,
        ],
        [
          3,
          "Clearer entrance information would help",
          "I visited with a family member who uses a walking aid. We appreciated the paved approach, but used the front steps to avoid the long detour. Better directions would make planning easier.",
          contributor,
        ],
      ] as const;
      for (const [i, b] of allBuildings.slice(0, 6).entries()) {
        for (const [
          j,
          [rating, title, body, author],
        ] of REVIEW_TEXT.entries()) {
          if ((i + j) % 3 === 2) continue; // vary how many reviews each building has
          await em.save(
            em.create(Review, {
              buildingId: b.id,
              userId: author.id,
              rating,
              title,
              body,
              visitDate: daysAgo(10 + i * 3 + j * 5)
                .toISOString()
                .slice(0, 10),
              featuresUsed: [F.STEP_FREE_ENTRANCE, F.RAMP],
              status: ReviewStatus.APPROVED,
              decidedAt: daysAgo(2),
            }),
          );
        }
      }
      // one pending and one not-published review for the demo contributor
      await em.save(
        em.create(Review, {
          buildingId: allBuildings[1].id,
          userId: contributor.id,
          rating: 4,
          title: "Ground-floor seating was easy to reach",
          body: "The ground-floor seating was easy to reach during my visit. The entrance area was busy, and I would appreciate clearer signs for the accessible route from the gate.",
          visitDate: daysAgo(6).toISOString().slice(0, 10),
          featuresUsed: [F.STEP_FREE_ENTRANCE],
          status: ReviewStatus.PENDING,
        }),
      );
      await em.save(
        em.create(Review, {
          buildingId: allBuildings[3].id,
          userId: contributor.id,
          rating: 3,
          title: "Hard to find the entrance",
          body: "I had difficulty finding the entrance for my afternoon class. I would like clearer information about which doorway visitors should use when arriving from the main road.",
          visitDate: daysAgo(12).toISOString().slice(0, 10),
          featuresUsed: [],
          status: ReviewStatus.REJECTED,
          moderatorNote:
            "Please add the entrance location and visit date before resubmitting.",
          decidedAt: daysAgo(3),
        }),
      );

      // A few open reports so the moderation queue is not empty during a demo
      for (const f of pendingTargets.slice(0, 3)) {
        await em.save(
          em.create(Report, {
            buildingId: f.buildingId,
            featureId: f.id,
            submittedById: contributor.id,
            observationStatus: FeatureStatus.AVAILABLE,
            observedAt: daysAgo(1),
            moderationStatus: ModerationStatus.PENDING,
            description: `Seed pending report: ${label(f.featureType)} looks usable, please verify.`,
          }),
        );
      }
    });

    console.log(
      `Seeded 3 users, ${BUILDINGS.length} buildings, features and reports.\n` +
        `  admin@gmail.com / moderator@gmail.com / contributor@gmail.com\n` +
        `  password: ${password}`,
    );
  }

  async drop() {
    if (appConfig.env.NODE_ENV === "production")
      throw new Error("Refusing to drop data in production");
    await this.ds.query(
      `TRUNCATE audit_logs, verifications, report_evidence, reports, reviews, saved_buildings, auth_tokens,
                accessibility_features, buildings, users RESTART IDENTITY CASCADE`,
    );
    void AuditLog; // keep entity registered for the truncate list above
  }
}
