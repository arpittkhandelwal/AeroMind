"""
Physics model package for the UAV Engine Digital Twin.

Exports:
  ThermodynamicModel — stateful per-mission model
  predict_nominal    — stateless convenience wrapper
"""

from engine_model import ThermodynamicModel, predict_nominal

__all__ = ["ThermodynamicModel", "predict_nominal"]
