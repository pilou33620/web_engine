//! Hasard reproductible (splitmix64) : une partie rejouée avec la même graine donne les mêmes tirages.
//! L'état se sauvegarde avec la partie.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Hasard {
    pub etat: u64,
}

/// Pour les champs ajoutés aux sauvegardes (`#[serde(default)]`) : la graine est fixée à la mise en place.
impl Default for Hasard {
    fn default() -> Self {
        Hasard::new(0)
    }
}

impl Hasard {
    pub fn new(graine: u64) -> Self {
        let mut h = Hasard { etat: graine ^ 0x9E37_79B9_7F4A_7C15 };
        h.suivant();
        h
    }

    pub fn suivant(&mut self) -> u64 {
        self.etat = self.etat.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.etat;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Un flottant dans [0, 1[.
    pub fn f(&mut self) -> f64 {
        (self.suivant() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Vrai avec la probabilité `p`.
    pub fn p(&mut self, p: f64) -> bool {
        self.f() < p
    }

    /// Un entier dans [a, b] (bornes comprises).
    pub fn entre(&mut self, a: i64, b: i64) -> i64 {
        if b <= a {
            return a;
        }
        a + (self.f() * ((b - a + 1) as f64)) as i64
    }

    /// Un indice au hasard dans une liste de longueur `n` (n > 0).
    pub fn indice(&mut self, n: usize) -> usize {
        ((self.f() * n as f64) as usize).min(n.saturating_sub(1))
    }

    pub fn choix<'a, T>(&mut self, l: &'a [T]) -> Option<&'a T> {
        if l.is_empty() {
            None
        } else {
            Some(&l[self.indice(l.len())])
        }
    }

    pub fn melanger<T>(&mut self, l: &mut [T]) {
        for i in (1..l.len()).rev() {
            let j = self.indice(i + 1);
            l.swap(i, j);
        }
    }

    /// Loi normale (Box-Muller), moyenne 0, écart-type 1.
    pub fn normale(&mut self) -> f64 {
        let u = self.f().max(1e-12);
        let v = self.f();
        (-2.0 * u.ln()).sqrt() * (std::f64::consts::TAU * v).cos()
    }
}

/// Bruit de valeur 2D lissé (plusieurs octaves), pour le relief et l'humidité.
pub struct Bruit {
    perm: [u8; 512],
    val: [f64; 256],
}

impl Bruit {
    pub fn new(graine: u64) -> Self {
        let mut h = Hasard::new(graine.wrapping_mul(9301).wrapping_add(49297));
        let mut p: Vec<u8> = (0..=255).collect();
        h.melanger(&mut p);
        let mut perm = [0u8; 512];
        for i in 0..512 {
            perm[i] = p[i & 255];
        }
        let mut val = [0.0; 256];
        for v in val.iter_mut() {
            *v = h.f();
        }
        Bruit { perm, val }
    }

    fn h(&self, x: i64, y: i64) -> f64 {
        let a = self.perm[(x & 255) as usize] as usize;
        self.val[self.perm[(a + (y & 255) as usize) & 511] as usize]
    }

    fn simple(&self, x: f64, y: f64) -> f64 {
        let (xi, yi) = (x.floor(), y.floor());
        let lis = |t: f64| t * t * (3.0 - 2.0 * t);
        let (u, v) = (lis(x - xi), lis(y - yi));
        let (xi, yi) = (xi as i64, yi as i64);
        let a = self.h(xi, yi);
        let b = self.h(xi + 1, yi);
        let c = self.h(xi, yi + 1);
        let d = self.h(xi + 1, yi + 1);
        let ab = a + (b - a) * u;
        let cd = c + (d - c) * u;
        ab + (cd - ab) * v
    }

    pub fn octaves(&self, x: f64, y: f64, n: u32) -> f64 {
        let (mut s, mut amp, mut fr, mut norme) = (0.0, 1.0, 1.0, 0.0);
        for i in 0..n {
            s += self.simple(x * fr + i as f64 * 17.3, y * fr - i as f64 * 9.1) * amp;
            norme += amp;
            amp *= 0.5;
            fr *= 2.0;
        }
        s / norme
    }
}

#[cfg(test)]
mod essais {
    use super::*;

    #[test]
    fn reproductible() {
        let mut a = Hasard::new(42);
        let mut b = Hasard::new(42);
        for _ in 0..100 {
            assert_eq!(a.suivant(), b.suivant());
        }
        let x = a.entre(3, 7);
        assert!((3..=7).contains(&x));
    }

    #[test]
    fn bruit_borne() {
        let b = Bruit::new(7);
        for i in 0..200 {
            let v = b.octaves(i as f64 * 0.37, i as f64 * 0.11, 4);
            assert!((0.0..=1.0).contains(&v));
        }
    }
}
