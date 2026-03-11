# Solid Protocol — LDP, WebID, and HTTP API

Build apps on Solid pods using standard HTTP. Resources are RDF (JSON-LD or Turtle), organized in LDP containers, protected by WebACL.

## Quick Reference

| Method | Purpose | Container | Resource |
|--------|---------|:---------:|:--------:|
| `GET` | Read | Listing | Content |
| `HEAD` | Headers only | ✓ | ✓ |
| `PUT` | Create/overwrite | ✓ | ✓ |
| `POST` | Create child | ✓ | ✗ |
| `DELETE` | Remove | ✓ | ✓ |
| `PATCH` | Partial update | ✗ | ✓ |
| `OPTIONS` | Capabilities | ✓ | ✓ |

## URIs

Containers end with `/`. Resources don't. This is mandatory.

```
https://alice.pod/docs/        ← container
https://alice.pod/docs/note1   ← resource
```

## Pod Structure

```
/{user}/
├── profile/
│   └── card              WebID profile (HTML + JSON-LD)
├── Settings/
│   ├── Preferences.ttl
│   ├── publicTypeIndex.ttl
│   └── privateTypeIndex.ttl
├── inbox/                ActivityPub / LDN inbox
├── public/
├── private/
└── .acl                  Root ACL
```

## WebID Profile

A WebID like `https://alice.pod/profile/card#me` identifies a person. The document at `https://alice.pod/profile/card` contains:

```json
{
  "@context": {
    "foaf": "http://xmlns.com/foaf/0.1/",
    "solid": "http://www.w3.org/ns/solid/terms#",
    "pim": "http://www.w3.org/ns/pim/space#",
    "ldp": "http://www.w3.org/ns/ldp#",
    "schema": "http://schema.org/"
  },
  "@id": "https://alice.pod/profile/card#me",
  "@type": "foaf:Person",
  "foaf:name": "Alice",
  "pim:storage": { "@id": "https://alice.pod/" },
  "solid:oidcIssuer": { "@id": "https://alice.pod/" },
  "ldp:inbox": { "@id": "https://alice.pod/inbox/" },
  "pim:preferencesFile": { "@id": "https://alice.pod/Settings/Preferences.ttl" },
  "solid:publicTypeIndex": { "@id": "https://alice.pod/Settings/publicTypeIndex.ttl" },
  "solid:privateTypeIndex": { "@id": "https://alice.pod/Settings/privateTypeIndex.ttl" }
}
```

## Key Profile Predicates

| Predicate | Purpose | Example |
|-----------|---------|---------|
| `foaf:name` | Display name | `"Alice"` |
| `pim:storage` | Pod root URI | `https://alice.pod/` |
| `solid:oidcIssuer` | Auth provider | `https://alice.pod/` |
| `ldp:inbox` | Notification inbox | `https://alice.pod/inbox/` |
| `pim:preferencesFile` | User settings | `https://alice.pod/Settings/Preferences.ttl` |
| `solid:publicTypeIndex` | Public type registry | `https://alice.pod/Settings/publicTypeIndex.ttl` |
| `solid:privateTypeIndex` | Private type registry | `https://alice.pod/Settings/privateTypeIndex.ttl` |

## Storage Discovery

Find a user's pod root from their WebID:

1. Fetch the WebID document
2. Check the `Link` header for `rel="http://www.w3.org/ns/pim/space#storage"`
3. Or read the `pim:storage` predicate from the profile

```
Link: <https://alice.pod/>; rel="http://www.w3.org/ns/pim/space#storage"
```

## Content Negotiation

| Content-Type | Format | Notes |
|-------------|--------|-------|
| `application/ld+json` | JSON-LD | Default, always supported |
| `text/turtle` | Turtle | Requires server support (conneg) |
| `text/n3` | Notation3 | Used for PATCH |
| `application/sparql-update` | SPARQL | Used for PATCH |

Request a format with the `Accept` header:

```http
GET /docs/note1 HTTP/1.1
Accept: text/turtle
```

Write with `Content-Type`:

```http
PUT /docs/note1 HTTP/1.1
Content-Type: application/ld+json

{"@context": {...}, ...}
```

**Content-Type is required on all write operations.** Missing it → `400 Bad Request`.

## CRUD Operations

### Read a Resource

```http
GET /docs/note1 HTTP/1.1
Accept: application/ld+json
```

### List a Container

```http
GET /docs/ HTTP/1.1
Accept: application/ld+json
```

Response:
```json
{
  "@context": { "ldp": "http://www.w3.org/ns/ldp#" },
  "@id": "https://alice.pod/docs/",
  "@type": ["ldp:Container", "ldp:BasicContainer", "ldp:Resource"],
  "ldp:contains": [
    { "@id": "https://alice.pod/docs/note1" },
    { "@id": "https://alice.pod/docs/photos/" }
  ]
}
```

### Create a Resource (PUT)

```http
PUT /docs/note1 HTTP/1.1
Content-Type: application/ld+json

{
  "@context": { "schema": "http://schema.org/" },
  "@type": "schema:TextDigitalDocument",
  "schema:text": "Hello world"
}
```

→ `201 Created` (new) or `204 No Content` (overwrite)

### Create a Resource (POST to Container)

```http
POST /docs/ HTTP/1.1
Content-Type: application/ld+json
Slug: my-note

{...}
```

→ `201 Created` with `Location: /docs/my-note`

The `Slug` header suggests a name. Server may modify it if taken. Without Slug, server generates a UUID.

### Create a Container

```http
POST /docs/ HTTP/1.1
Content-Type: application/ld+json
Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"
Slug: photos
```

Or simply PUT with a trailing slash:

```http
PUT /docs/photos/ HTTP/1.1
```

### Delete a Resource

```http
DELETE /docs/note1 HTTP/1.1
```

→ `204 No Content`

### PATCH a Resource (N3)

```http
PATCH /profile/card HTTP/1.1
Content-Type: text/n3

@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

_:patch a solid:InsertDeletePatch;
  solid:deletes {
    <#me> foaf:name "Old Name" .
  };
  solid:inserts {
    <#me> foaf:name "Alice" .
  }.
```

### PATCH a Resource (SPARQL Update)

```http
PATCH /profile/card HTTP/1.1
Content-Type: application/sparql-update

PREFIX foaf: <http://xmlns.com/foaf/0.1/>

DELETE { <#me> foaf:name ?old . }
INSERT { <#me> foaf:name "Alice" . }
WHERE  { <#me> foaf:name ?old . }
```

→ `204 No Content` (updated) or `201 Created` (new resource)

## Conditional Requests (ETags)

Every response includes an `ETag` header. Use it for safe concurrent updates.

### Update Only If Unchanged

```http
PUT /docs/note1 HTTP/1.1
Content-Type: application/ld+json
If-Match: "abc123"

{...}
```

→ `412 Precondition Failed` if resource changed since you read it.

### Create Only If New

```http
PUT /docs/note1 HTTP/1.1
Content-Type: application/ld+json
If-None-Match: *

{...}
```

→ `412 Precondition Failed` if resource already exists.

### Cache Validation

```http
GET /docs/note1 HTTP/1.1
If-None-Match: "abc123"
```

→ `304 Not Modified` if unchanged (use cached copy).

## Link Headers

Every response includes `Link` headers describing the resource:

```
Link: <http://www.w3.org/ns/ldp#Resource>; rel="type",
      <http://www.w3.org/ns/ldp#Container>; rel="type",
      <https://alice.pod/docs/.acl>; rel="acl",
      <https://alice.pod/>; rel="http://www.w3.org/ns/pim/space#storage"
```

| Relation | Purpose |
|----------|---------|
| `rel="type"` + `ldp:Resource` | This is an LDP resource |
| `rel="type"` + `ldp:Container` | This is an LDP container |
| `rel="type"` + `ldp:BasicContainer` | This is a basic container |
| `rel="acl"` | ACL file controlling access |
| `rel="http://www.w3.org/ns/pim/space#storage"` | Pod root |

## Standard Response Headers

```
Allow: GET, HEAD, PUT, DELETE, PATCH, OPTIONS, POST
Accept-Patch: text/n3, application/sparql-update
Accept-Put: application/ld+json, text/turtle
Accept-Post: application/ld+json, text/turtle
Vary: Accept, Authorization, Origin
Content-Type: application/ld+json
ETag: "hash"
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: Accept-Patch, Accept-Post, Accept-Put,
  Allow, Content-Type, ETag, Link, Location, WAC-Allow
```

## Status Codes

| Code | Meaning |
|------|---------|
| `200` | GET/HEAD success |
| `201` | Resource created (PUT/POST/PATCH) |
| `204` | Success, no body (PUT/DELETE/PATCH) |
| `301` | Redirect (missing trailing slash on container) |
| `304` | Not modified (ETag match) |
| `400` | Bad request (missing Content-Type, malformed body) |
| `401` | Not authenticated |
| `403` | Forbidden (ACL denies access) |
| `404` | Not found |
| `405` | Method not allowed |
| `409` | Conflict |
| `412` | Precondition failed (ETag mismatch) |
| `415` | Unsupported media type |
| `507` | Insufficient storage (quota exceeded) |

## Common Pitfalls

1. **Missing `Content-Type`** on PUT/POST/PATCH → `400`
2. **Missing trailing slash** on container URIs → redirect or `409`
3. **POST to a resource** instead of a container → `405`
4. **Forgetting `If-Match`** on updates → risk of overwriting concurrent changes
5. **Assuming HTML profile is just JSON-LD** — profiles may be HTML with embedded JSON-LD
6. **Ignoring ETags** — always store and send them for safe updates

## Access Control

See [webacl.md](webacl.md) for full WebACL reference.

Quick summary: every resource has a `.acl` file. The `WAC-Allow` header shows current permissions:

```
WAC-Allow: user="read write control", public="read"
```

## Specifications

- [Solid Protocol](https://solidproject.org/TR/protocol) — W3C Solid CG
- [WebID](https://www.w3.org/2005/Incubator/webid/spec/identity/) — W3C
- [Linked Data Platform](https://www.w3.org/TR/ldp/) — W3C Recommendation
- [Web Access Control](https://solid.github.io/web-access-control-spec/) — W3C Solid CG
- [Solid-OIDC](https://solid.github.io/solid-oidc/) — W3C Solid CG

## License

AGPL-3.0
