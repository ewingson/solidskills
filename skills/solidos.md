# SolidOS — Data Browser for Solid

Build panes and extensions for SolidOS, the operating system for Solid pods. View, edit, and manage linked data through a modular pane architecture.

## What is SolidOS?

SolidOS is a web-based data browser that provides a UI for Solid pods. It renders linked data using pluggable **panes** — small applets that know how to display and edit specific types of data (contacts, chat, files, profiles, etc.).

- Website: https://solidos.org
- GitHub: https://github.com/SolidOS
- Live demo: https://solidos.github.io/mashlib/dist/browse.html

## Architecture

```
mashlib                      Bundled browser app (entry point)
  └── solid-panes            Pane registry + built-in panes
        └── solid-ui          UI component library (widgets, forms, tabs)
              └── solid-logic  Business logic (authn, ACL, pod discovery)
                    └── rdflib.js  RDF/JS library (fetch, parse, store, query)
```

### Package Overview

| Package | npm | Description |
|---------|-----|-------------|
| [mashlib](https://github.com/SolidOS/mashlib) | `mashlib@2.1.3` | Bundled data browser. Loads in `<script>` tag or iframe |
| [solid-panes](https://github.com/SolidOS/solid-panes) | `solid-panes@4.2.3` | Pane registry and built-in panes |
| [solid-ui](https://github.com/SolidOS/solid-ui) | `solid-ui@3.0.4` | UI widgets: buttons, forms, tabs, ACL editor, chat |
| [solid-logic](https://github.com/SolidOS/solid-logic) | `solid-logic@4.0.4` | Auth, profile, ACL, pod discovery, preferences |
| [rdflib.js](https://github.com/linkeddata/rdflib.js) | `rdflib` | RDF store, fetcher, serializer, SPARQL |

## Pane Architecture

A **pane** is a module that can render a specific type of linked data. SolidOS selects the best pane for a given resource based on type matching.

### Pane Interface

Every pane exports an object with:

```js
export default {
  // Unique icon for the pane tab
  icon: 'https://example.com/icon.svg',

  // Human-readable name
  name: 'myPane',

  // Display label
  label: (subject, context) => {
    // Return a string label if this pane can render the subject
    // Return null if it cannot
    const dominated = context.session.store.any(subject, RDF('type'), SCHEMA('Thing'))
    return dominated ? 'My View' : null
  },

  // Render the pane content
  render: (subject, context) => {
    const div = context.dom.createElement('div')
    // Build UI using subject data from context.session.store
    return div
  }
}
```

### Pane Selection

1. User navigates to a resource URI
2. SolidOS fetches the resource into the RDF store
3. Each registered pane's `label()` is called with the subject
4. Panes that return a non-null label are shown as tabs
5. The first matching pane renders by default

### Built-in Panes

| Pane | Repo | Matches |
|------|------|---------|
| Chat | [chat-pane](https://github.com/SolidOS/chat-pane) | `meeting:LongChat`, `meeting:ShortChat` |
| Contacts | [contacts-pane](https://github.com/SolidOS/contacts-pane) | `vcard:AddressBook`, `vcard:Individual` |
| Folder | [folder-pane](https://github.com/SolidOS/folder-pane) | `ldp:Container` |
| Profile | [profile-pane](https://github.com/SolidOS/profile-pane) | `foaf:Person`, `schema:Person` |
| Meeting | [meeting-pane](https://github.com/SolidOS/meeting-pane) | `meeting:Meeting` |
| Issue | [issue-pane](https://github.com/SolidOS/issue-pane) | `wf:Tracker`, `wf:Issue` |
| Source | [source-pane](https://github.com/SolidOS/source-pane) | Any RDF resource (raw view) |
| Markdown | [markdown-pane](https://github.com/SolidOS/markdown-pane) | `text/markdown` resources |

## Embedding SolidOS

### Via mashlib bundle

```html
<script src="https://solidos.github.io/mashlib/dist/mashlib.min.js"></script>
<script>
  const subject = $rdf.sym(window.location.href)
  const outline = panes.getOutliner(document)
  outline.GotoSubject(subject, true)
</script>
```

### Via browse.html

Serve `browse.html` from the mashlib dist and navigate to any Solid resource:

```
https://your-server/browse.html?uri=https://alice.pod/profile/card#me
```

### With CSS (Community Solid Server)

CSS can serve mashlib as the default data browser using `css-mashlib`:

```bash
npm install @solid/community-server css-mashlib
npx community-solid-server -c @css:config/file.json
```

## Type Index

The **type index** maps RDF types to locations in the pod, so apps know where to find data.

### Public Type Index

Located at the URI in `solid:publicTypeIndex` from the WebID profile.

```turtle
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix schema: <http://schema.org/> .

<#contacts>
    a solid:TypeRegistration ;
    solid:forClass vcard:AddressBook ;
    solid:instance </contacts/book.ttl> .

<#bookmarks>
    a solid:TypeRegistration ;
    solid:forClass schema:BookmarkAction ;
    solid:instanceContainer </bookmarks/> .
```

### Key Predicates

| Predicate | Use |
|-----------|-----|
| `solid:forClass` | The RDF type this registration is for |
| `solid:instance` | A specific resource of that type |
| `solid:instanceContainer` | A container where instances live |

### Private Type Index

Same format, at `solid:privateTypeIndex`. Not publicly visible.

## rdflib.js Essentials

SolidOS uses rdflib.js for all data operations.

### Store and Fetcher

```js
const store = $rdf.graph()
const fetcher = new $rdf.Fetcher(store)

// Fetch a resource into the store
await fetcher.load('https://alice.pod/profile/card')

// Query the store
const name = store.any(
  $rdf.sym('https://alice.pod/profile/card#me'),
  $rdf.sym('http://xmlns.com/foaf/0.1/name')
)
console.log(name.value)  // "Alice"
```

### Common Operations

```js
const me = $rdf.sym('https://alice.pod/profile/card#me')
const FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/')
const VCARD = $rdf.Namespace('http://www.w3.org/2006/vcard/ns#')

// Read a single value
const name = store.any(me, FOAF('name'))

// Read all values
const friends = store.each(me, FOAF('knows'))

// Check a type
const isPerson = store.holds(me, RDF('type'), FOAF('Person'))

// Update (add/remove triples)
const ins = [$rdf.st(me, FOAF('name'), 'Alice')]
const del = [$rdf.st(me, FOAF('name'), 'Old Name')]
await new $rdf.UpdateManager(store).update(del, ins)
```

### Namespaces

```js
const RDF   = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
const RDFS  = $rdf.Namespace('http://www.w3.org/2000/01/rdf-schema#')
const OWL   = $rdf.Namespace('http://www.w3.org/2002/07/owl#')
const FOAF  = $rdf.Namespace('http://xmlns.com/foaf/0.1/')
const VCARD = $rdf.Namespace('http://www.w3.org/2006/vcard/ns#')
const LDP   = $rdf.Namespace('http://www.w3.org/ns/ldp#')
const SOLID = $rdf.Namespace('http://www.w3.org/ns/solid/terms#')
const PIM   = $rdf.Namespace('http://www.w3.org/ns/pim/space#')
const ACL   = $rdf.Namespace('http://www.w3.org/ns/auth/acl#')
const SCHEMA = $rdf.Namespace('http://schema.org/')
const DCTERMS = $rdf.Namespace('http://purl.org/dc/terms/')
const SIOC  = $rdf.Namespace('http://rdfs.org/sioc/ns#')
const MEETING = $rdf.Namespace('http://www.w3.org/ns/pim/meeting#')
const WF    = $rdf.Namespace('http://www.w3.org/2005/01/wf/flow#')
```

## solid-ui Widgets

The `solid-ui` library provides reusable UI components:

| Widget | Purpose |
|--------|---------|
| `UI.authn` | Login/logout buttons, WebID display |
| `UI.widgets.buttons` | Standard button styles |
| `UI.tabs` | Tabbed interface for pane switching |
| `UI.aclControl` | ACL editor widget |
| `UI.widgets.forms` | Form generation from ontologies |
| `UI.matrix` | Table/matrix views for data |

## Development Setup

```bash
# Clone the monorepo setup
git clone https://github.com/SolidOS/solidos
cd solidos
npm run setup     # Clones all sub-repos
npm run build     # Builds all packages
npm run start     # Starts local dev server
```

### Development with a Solid server

```bash
# Using CSS
npx community-solid-server -c @css:config/file.json

# Using JSS
npx jss --port 5420 --single-user-name alice
```

Then open the mashlib browse.html pointing at your local server.

## Common Vocabularies

| Prefix | URI | Used For |
|--------|-----|----------|
| `foaf` | `http://xmlns.com/foaf/0.1/` | People, profiles |
| `vcard` | `http://www.w3.org/2006/vcard/ns#` | Contacts, addresses |
| `schema` | `http://schema.org/` | General-purpose types |
| `ldp` | `http://www.w3.org/ns/ldp#` | Containers, resources |
| `solid` | `http://www.w3.org/ns/solid/terms#` | Solid-specific terms |
| `pim` | `http://www.w3.org/ns/pim/space#` | Storage, preferences |
| `acl` | `http://www.w3.org/ns/auth/acl#` | Access control |
| `meeting` | `http://www.w3.org/ns/pim/meeting#` | Chat, meetings |
| `wf` | `http://www.w3.org/2005/01/wf/flow#` | Issue tracking |
| `sioc` | `http://rdfs.org/sioc/ns#` | Online communities |
| `dcterms` | `http://purl.org/dc/terms/` | Metadata |

## Specifications

- [Solid Protocol](https://solidproject.org/TR/protocol) — W3C Solid CG
- [SolidOS Website](https://solidos.org)
- [rdflib.js Documentation](https://linkeddata.github.io/rdflib.js/doc/)
- [Linked Data Platform](https://www.w3.org/TR/ldp/) — W3C Recommendation

## License

MIT
