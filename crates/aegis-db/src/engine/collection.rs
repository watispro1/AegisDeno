use parking_lot::RwLock;
use serde_json::Value;
use std::collections::BTreeMap;

pub struct Collection {
    name: String,
    docs: RwLock<BTreeMap<String, Value>>,
}

impl Collection {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            docs: RwLock::new(BTreeMap::new()),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn len(&self) -> usize {
        self.docs.read().len()
    }

    pub fn is_empty(&self) -> bool {
        self.docs.read().is_empty()
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        self.docs.read().get(key).cloned()
    }

    pub fn put(&self, key: String, val: Value) -> Option<Value> {
        self.docs.write().insert(key, val)
    }

    pub fn delete(&self, key: &str) -> Option<Value> {
        self.docs.write().remove(key)
    }

    pub fn all(&self) -> Vec<(String, Value)> {
        self.docs
            .read()
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }

    pub fn prefix_scan(&self, prefix: &str) -> Vec<(String, Value)> {
        let lock = self.docs.read();
        lock.range(prefix.to_string()..)
            .take_while(|(k, _)| k.starts_with(prefix))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }

    pub fn find_with_predicate<F>(&self, predicate: F) -> Vec<(String, Value)>
    where
        F: Fn(&str, &Value) -> bool,
    {
        self.docs
            .read()
            .iter()
            .filter(|(k, v)| predicate(k, v))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect()
    }

    pub fn clear(&self) {
        self.docs.write().clear();
    }
}
