"""El alta no se cae por un falso positivo del detector."""
from types import SimpleNamespace

import pytest

from app.pipeline.facade import FaceQualityError, select_enroll_face


def face(score, box):
    return SimpleNamespace(det_score=score, bbox=box)


def test_un_rostro():
    only = face(0.95, (10, 10, 200, 220))
    assert select_enroll_face([only]) is only


def test_sin_rostro():
    with pytest.raises(FaceQualityError) as err:
        select_enroll_face([])
    assert err.value.reason == "NO_FACE"


def test_caja_duplicada_de_la_misma_persona():
    primary = face(0.96, (40, 30, 280, 320))
    duplicate = face(0.81, (55, 48, 270, 300))
    assert select_enroll_face([duplicate, primary]) is primary


def test_recorte_dentro_del_rostro():
    primary = face(0.94, (20, 20, 300, 340))
    eye = face(0.72, (80, 90, 140, 140))
    assert select_enroll_face([primary, eye]) is primary


def test_falso_positivo_chico():
    primary = face(0.93, (30, 40, 360, 420))
    poster = face(0.62, (400, 20, 450, 70))
    assert select_enroll_face([poster, primary]) is primary


def test_dos_personas():
    a = face(0.94, (10, 20, 250, 300))
    b = face(0.88, (280, 30, 520, 340))
    with pytest.raises(FaceQualityError) as err:
        select_enroll_face([a, b])
    assert err.value.reason == "MULTIPLE_FACES"
