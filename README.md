# INBTWN OS

INBTWN OS

Build 1 — Foundation, Clients, Enquiries & Events

Build the first production-ready foundation of a mobile-first catering operations application called INBTWN OS.

INBTWN OS is an internal operating system for a professional catering business. It will eventually manage the entire lifecycle of catering work:

Enquiries → menus → quotes → bookings → recipes → production quantities → shopping → prep → equipment → staffing → event execution → invoicing → profitability.

This first build must establish the architecture and user experience without trying to build all future functionality.

1. TECHNOLOGY

Use:

Lovable for the application

Supabase for database, authentication and storage

Responsive mobile-first web application/PWA architecture

TypeScript

Clean relational database design

The application must work well on:

iPhone

Desktop browser

Design for iPhone first.

Do not use mock data as the permanent data source. All created clients and events must persist in Supabase.

2. CORE PRINCIPLE

An Event is the central object in INBTWN OS.

An enquiry is not a separate type of object that later gets copied into a job.

Instead, an Event progresses through statuses:

Enquiry

Quoting

Awaiting Client

Confirmed

In Progress

Completed

Lost

Cancelled

Information must remain attached to the same Event throughout its lifecycle.

3. ORGANISATION

Create an organisation-based architecture from the beginning.

Create:

organisations

Fields:

id

name

created_at

updated_at

Create:

profiles

Fields:

id

organisation_id

user_id

name

email

role

active

created_at

updated_at

For now the only required role is:

owner

However, structure the system so additional roles can be introduced later.

All business records must belong to an organisation.

Use Supabase Row Level Security so authenticated users can only access records belonging to their organisation.

4. AUTHENTICATION

Implement:

Sign up

Sign in

Sign out

Persistent authentication session

On first signup:

Create the user.

Create an organisation.

Ask for organisation name.

Create an owner profile linked to the organisation.

After authentication, send the user to Today.

5. MOBILE NAVIGATION

Use five permanent bottom navigation items on mobile:

Today

Events

+

Library

Ask

The centre + should visually stand out.

Desktop may use an appropriate sidebar while preserving the same information architecture.

For Build 1:

Today = functional basic dashboard

Events = functional



= functional Quick Add

Library = basic shell with Clients functional

Ask = placeholder screen

Do not build AI yet.

6. VISUAL DIRECTION

INBTWN should feel:

premium

modern

understated

food/hospitality oriented

operational rather than corporate

Prioritise information hierarchy and speed.

Use:

generous whitespace

strong typography

clear status indicators

restrained rounded cards

large touch targets

clear primary actions

Avoid:

excessive gradients

excessive animations

tiny text

cluttered dashboards

generic CRM appearance

unnecessary charts

The interface should be practical enough to use while standing in a kitchen or at an event.

7. CLIENT DATABASE

Create:

clients

Fields:

id

organisation_id

client_type

company_name

first_name

last_name

email

phone

billing_address

default_event_address

notes

created_at

updated_at

Client types:

Individual

Corporate

Agency

Venue

Other

A client may have many Events.

8. CLIENT LIBRARY

Under:

Library → Clients

Create:

client list

search

add client

client detail

edit client

Client list cards should show:

name/company

email or phone

number of Events if available

Client detail should show:

contact details

notes

associated Events

Do not build complex CRM functionality yet.

9. EVENTS DATABASE

Create:

events

Fields:

id

organisation_id

client_id

title

source

source_reference

status

event_type

cuisine

service_style

event_date

arrival_time

service_time

end_time

guest_count

guest_count_status

venue_name

venue_address

venue_contact_name

venue_contact_phone

budget

currency

internal_notes

created_at

updated_at

Default currency:

GBP

Do not hard-code currency assumptions into calculations so additional currencies can be supported later.

10. EVENT SOURCES

Support:

Togather

Poptop

Direct

Email

Website

Referral

Repeat Client

Instagram

WhatsApp

Other

Lead source must be visible on enquiry cards.

Togather and Poptop should have recognisable text labels/badges but should not dominate the design.

11. EVENT TYPES

Provide sensible starting options:

Corporate Catering

Private Dinner

Wedding

Birthday

Office Lunch

Buffet

Canapé Reception

BBQ

Drop-Off Catering

Market / Festival

Private Chef

Other

These may later become configurable templates, so do not architect them in a way that prevents that.

12. SERVICE STYLES

Initial options:

Drop-Off

Buffet

Family Style

Plated

Sharing

Canapés

Bowl Food

BBQ

Stall Service

Other

13. GUEST COUNT STATUS

Support:

Estimated

Booked

Confirmed

Final

For Build 1 store the current guest count on the Event.

The architecture should not prevent guest-count history from being added later.

14. DIETARY REQUIREMENTS

Create:

event_dietaries

Fields:

id

event_id

organisation_id

type

guest_count

notes

severity

confirmed

created_at

updated_at

Allow dietaries to be added and removed from the Event.

Provide common quick options:

Vegetarian

Vegan

Gluten Free

Dairy Free

Nut Allergy

Peanut Allergy

Sesame Allergy

Shellfish Allergy

Other Allergy

Other Dietary Requirement

Do not attempt medical/allergen reasoning in Build 1.

This section is for recording client information only.

15. CREATE ENQUIRY

Quick Add must include:

New Enquiry

The form should be fast and mobile-friendly.

Required fields:

Event title

Event date

Guest count

Lead source

Client:

select existing client

or create new client inline

Optional fields:

budget

event type

cuisine

service style

venue

arrival time

service time

end time

source reference

notes

dietaries

Default status:

Enquiry

Do not force users to complete every field before creating an enquiry.

This is important.

A lead often arrives with incomplete information.

16. EVENTS SCREEN

Create:

Events

At the top:

search

filter chips

Filters:

All

Enquiries

Quotes

Confirmed

This Week

Completed

Map statuses appropriately.

Event cards should show:

status

lead source where relevant

title

date

guest count

location/venue where available

budget or confirmed value where available

basic attention/status indicator

Do not overload cards with information.

Tap card → Event Detail.

17. EVENT DETAIL

Create the permanent Event Detail architecture now.

Header:

title

status

date

guests

location

budget/value if available

Provide a clear way to edit the Event.

Below the header create navigation/cards for:

Overview

Menu

Production

Shopping

Packing

Staff

Client

Finance

More

For Build 1:

Overview and Client should be functional.

The other areas should show polished placeholders such as:

"Menu planning will be added in the next build."

Do not invent fake functionality.

18. EVENT OVERVIEW

Show:

Event

date

arrival time

service time

end time

guest count

event type

cuisine

service style

venue

Client

client name

company if relevant

email

phone

Provide tap actions where appropriate:

email

call

Dietaries

Display recorded dietary requirements.

Notes

Internal notes.

Status

Allow Event status to be changed.

Readiness

Create a visual readiness area with:

Client

Menu

Shopping

Production

Equipment

Payment

For Build 1 only Client should have real logic.

Other readiness states may display:

Not set up yet

Do not generate fake completion percentages.

19. TODAY DASHBOARD

Today should answer:

What needs my attention?

For Build 1 implement basic useful logic using existing Event data.

Sections:

Needs Attention

Examples:

Enquiry has not progressed from Enquiry status after a reasonable period

Upcoming Event missing client

Upcoming Event missing service time

Upcoming Event has no guest count

Confirmed Event approaching soon

Keep this basic.

Maximum five attention cards initially.

Provide:

View all

Upcoming Events

Show Events within the next seven days.

Card:

date

title

guest count

status

Enquiries

Show count of active enquiries.

Quotes

Show count of Events in Quoting or Awaiting Client.

Do not add charts.

20. QUICK ADD

Centre + opens a bottom sheet/menu.

For Build 1:

New Enquiry

New Client

Show future actions disabled or labelled "Coming later":

Expense

Task

Purchase

Recipe

Do not create fake screens for these.

21. LIBRARY

Create Library home.

Cards:

Recipes — Coming later

Ingredients — Coming later

Equipment — Coming later

Clients — Functional

Suppliers — Coming later

Templates — Coming later

Clients opens the Client Library.

22. ASK

Create a polished placeholder:

Ask INBTWN

Text:

"Ask questions about your events, recipes, shopping, production and business."

Input may be visually present but should clearly state:

Coming in a later build

Do not connect an LLM yet.

23. SEARCH

Events search should search:

Event title

Client name

Company name

Venue

source reference

Client search should search:

name

company

email

phone

Global search can be added later.

24. DATE/TIME UX

Dates should be shown naturally in the UI, e.g.:

Sat 24 Oct

Times:

18:30

Use UK date conventions.

Database should use proper date/time types rather than storing formatted strings.

25. MOBILE BEHAVIOUR

Optimise every screen for iPhone.

Requirements:

bottom navigation remains easy to reach

minimum comfortable touch target sizes

forms use appropriate mobile input types

numeric keyboard for guest count/budget

date picker for dates

time picker for times

phone/email links where appropriate

sticky primary actions where helpful

avoid horizontal scrolling

no desktop tables on mobile

26. DATA SAFETY

Important:

never delete an Event accidentally

destructive actions require confirmation

prefer archive/status changes over deletion

validate required fields

show useful error messages

prevent cross-organisation data access

use Supabase Row Level Security

27. DATABASE DESIGN PRINCIPLE

This application will later contain:

versioned recipes

ingredients

production profiles

menu versions

quotes

shopping requirements

equipment

packing

tasks

expenses

invoices

payments

staff

AI actions

Do not attempt to create all these tables now.

However, keep the Event architecture clean and relational so these modules can reference event_id later without redesigning Events.

28. DO NOT BUILD YET

Do not implement:

Recipe Engine

Menu calculations

Quotes

Proposal PDFs

Shopping calculations

Procurement

Inventory

Production scheduling

Packing logic

Equipment allocation

Staff management

Invoicing

Expenses

Gmail

Togather API integration

Poptop integration

TimeTree integration

AI

Voice

receipt scanning

supplier ordering

client portal

Placeholders are acceptable where required by the permanent navigation.

The purpose of Build 1 is a stable foundation.

29. SEED DATA

After the schema is working, create a small amount of clearly identifiable demo data for development/testing.

Examples:

Togather enquiry

Corporate Summer Party
80 guests
£2,500 budget
Korean buffet

Confirmed Event

Corporate Lunch
110 guests

Private Dinner

14 guests

Do not mix demo data with production data without making it obvious that it is sample/demo data.

30. ACCEPTANCE CRITERIA

Build 1 is complete when:

I can create an account and organisation.

I can sign in/out reliably.

I can create a Client.

I can create an Enquiry.

I can select Togather or Poptop as the lead source.

I can record incomplete enquiries without unnecessary required fields.

I can record dietary requirements.

I can edit an Event.

I can move an Event through statuses.

I can search/filter Events.

I can open an Event and see its Overview.

I can open the associated Client.

I can see upcoming Events on Today.

The app works cleanly on an iPhone-sized viewport.

Data persists in Supabase.

Row Level Security prevents access to another organisation's records.

Future modules have clear places to connect without redesigning the Event model.

Do not proceed to the Recipe Engine until this foundation is working reliably.

The next planned development phase after Build 1 is:

Build 2 — Recipe Engine, Ingredients, Production Profiles & Recipe Scaling.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/403e16cf-946d-4c15-aa12-ec9fc8b7c550).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
