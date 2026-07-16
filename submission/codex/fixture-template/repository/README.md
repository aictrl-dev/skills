# AICtrl reviewer fixture

This dependency-free repository is the deterministic baseline for AICtrl's
public plugin review cases. It intentionally contains one small JavaScript
module and a fast Node test suite.

```bash
npm test
```

It must remain public and contain no credentials, customer data, private
dependencies, production integrations, deployment configuration, or
organization-only instructions. Reviewer workflows may create feature branches
and pull requests but never merge or deploy automatically.
